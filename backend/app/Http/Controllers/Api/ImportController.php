<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\ImportBatch;
use App\Models\Module;
use App\Models\Student;
use App\Models\User;
use App\Services\AuditLogger;
use App\Services\ImportFileReader;
use App\Services\SchoolEmail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use RuntimeException;

class ImportController extends Controller
{
    public function previewStudents(Request $request, Group $group, ImportFileReader $reader)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Only administrators can import student rosters.'], 403);
        if ($group->status !== 'active') return response()->json(['message' => 'Student rosters can only be imported into active groups.'], 422);
        $request->validate(['file' => 'required|file|max:5120|mimes:csv,txt,xlsx,docx']);

        try {
            $rows = $reader->studentRows($request->file('file'));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $batch = $this->batch($request, 'student', $rows, $group->id);
        return response()->json(['data' => ['batch_id' => $batch->id, 'rows' => $rows, 'expires_at' => $batch->expires_at->toISOString()]]);
    }

    public function commitStudents(Request $request, ImportBatch $batch)
    {
        if ($request->user()->role !== 'admin' || !$this->available($request, $batch, 'student')) return response()->json(['message' => 'Forbidden or expired import preview.'], 403);
        $data = $request->validate([
            'rows' => 'required|array|min:1',
            'rows.*.index' => 'required|integer|min:0',
            'rows.*.action' => 'required|in:import,update,skip',
            'rows.*.first_name' => 'nullable|string|max:100',
            'rows.*.last_name' => 'nullable|string|max:100',
        ]);

        $source = collect($batch->payload['rows'] ?? [])->keyBy('index');
        $instructions = collect($data['rows'])->keyBy('index');
        $credentials = [];
        try {
            $result = DB::transaction(function () use ($batch, $source, $instructions, &$credentials) {
            $created = 0;
            $updated = 0;
            $skipped = 0;
            $group = Group::findOrFail($batch->group_id);
            if ($group->status !== 'active') throw new RuntimeException('This group is no longer active. Choose an active group and upload the roster again.');

            foreach ($source as $index => $row) {
                $instruction = $instructions->get($index, ['action' => 'skip']);
                $action = $instruction['action'];
                if ($action === 'skip' || in_array($row['status'], ['invalid', 'duplicate_locked'], true)) {
                    $skipped++;
                    continue;
                }
                $firstName = trim($instruction['first_name'] ?? $row['first_name']);
                $lastName = trim($instruction['last_name'] ?? $row['last_name']);
                if ($firstName === '' || $lastName === '') throw new RuntimeException('Every imported student needs a first and last name.');

                $existing = Student::query()->with('user')->where('cne', $row['cne'])->lockForUpdate()->first();
                if ($existing) {
                    $existing->user->update(['first_name' => $firstName, 'last_name' => $lastName]);
                    $existing->groups()->syncWithoutDetaching([$group->id]);
                    // Keep the legacy single-group column pointing at the most
                    // recent group so listings that still read it stay correct.
                    $existing->update(['group_id' => $group->id]);
                    $updated++;
                    continue;
                }

                if ($action !== 'import') throw new RuntimeException('This student is new and must be imported or skipped.');
                $password = Str::random(16);
                $email = SchoolEmail::generate($firstName, $lastName);
                $user = User::create([
                    'first_name' => $firstName,
                    'last_name' => $lastName,
                    'email' => $email,
                    'password' => Hash::make($password),
                    'role' => 'student',
                    'is_active' => true,
                    'must_change_password' => true,
                ]);
                $student = Student::create(['user_id' => $user->id, 'cne' => $row['cne'], 'group_id' => $group->id]);
                $student->groups()->syncWithoutDetaching([$group->id]);
                $credentials[] = ['first_name' => $firstName, 'last_name' => $lastName, 'cne' => $row['cne'], 'email' => $email, 'temporary_password' => $password];
                $created++;
            }

            $batch->update(['payload' => [], 'committed_at' => now()]);
            return compact('created', 'updated', 'skipped');
            });
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        AuditLogger::record($request->user(), 'students.imported', 'Imported roster into ' . $batch->group->name . '.', $batch->group, ['created' => $result['created'], 'updated' => $result['updated'], 'skipped' => $result['skipped']]);
        return response()->json(['data' => $result + ['credentials' => $credentials]]);
    }

    public function previewModules(Request $request, ImportFileReader $reader)
    {
        $teacher = $this->teacher($request);
        if (!$teacher) return response()->json(['message' => 'Forbidden'], 403);
        $request->validate(['file' => 'required|file|max:5120|mimes:csv,txt,xlsx,docx']);
        try {
            $rows = $reader->moduleRows($request->file('file'), $teacher);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
        $batch = $this->batch($request, 'module', $rows);
        return response()->json(['data' => ['batch_id' => $batch->id, 'rows' => $rows, 'expires_at' => $batch->expires_at->toISOString()]]);
    }

    public function commitModules(Request $request, ImportBatch $batch)
    {
        $teacher = $this->teacher($request);
        if (!$teacher || !$this->available($request, $batch, 'module')) return response()->json(['message' => 'Forbidden or expired import preview.'], 403);
        $data = $request->validate(['rows' => 'required|array|min:1', 'rows.*.index' => 'required|integer|min:0', 'rows.*.action' => 'required|in:import,skip', 'rows.*.name' => 'nullable|string|max:100']);
        $source = collect($batch->payload['rows'] ?? [])->keyBy('index');
        $instructions = collect($data['rows'])->keyBy('index');
        try {
            $result = DB::transaction(function () use ($batch, $teacher, $source, $instructions) {
            $created = 0;
            $skipped = 0;
            foreach ($source as $index => $row) {
                $instruction = $instructions->get($index, ['action' => 'skip']);
                if ($instruction['action'] === 'skip' || $row['status'] !== 'new') { $skipped++; continue; }
                $name = trim($instruction['name'] ?? $row['name']);
                if ($name === '') throw new RuntimeException('Module names cannot be empty.');
                if (Module::where('teacher_id', $teacher->id)->whereRaw('LOWER(name) = ?', [mb_strtolower($name)])->exists()) { $skipped++; continue; }
                Module::create(['teacher_id' => $teacher->id, 'name' => $name]);
                $created++;
            }
            $batch->update(['payload' => [], 'committed_at' => now()]);
            return compact('created', 'skipped');
            });
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }
        AuditLogger::record($request->user(), 'modules.imported', 'Imported modules.', null, $result);
        return response()->json(['data' => $result]);
    }

    private function batch(Request $request, string $type, array $rows, ?int $groupId = null): ImportBatch
    {
        ImportBatch::where('user_id', $request->user()->id)->where('expires_at', '<', now())->delete();
        return ImportBatch::create(['user_id' => $request->user()->id, 'group_id' => $groupId, 'type' => $type, 'payload' => ['rows' => $rows], 'expires_at' => now()->addHour()]);
    }

    private function teacher(Request $request)
    {
        return $request->user()->role === 'teacher' ? $request->user()->teacher : null;
    }

    private function available(Request $request, ImportBatch $batch, string $type): bool
    {
        return (int) $batch->user_id === (int) $request->user()->id
            && $batch->type === $type
            && !$batch->committed_at
            && $batch->expires_at->isFuture();
    }
}
