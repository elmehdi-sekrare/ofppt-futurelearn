<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Group;
use App\Models\ImportBatch;
use App\Models\Module;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use App\Services\AssignmentWorkbookReader;
use App\Services\AuditLogger;
use App\Services\ImportFileReader;
use App\Services\SchoolEmail;
use App\Services\StudentListReader;
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
        $data = $request->validate(['rows' => 'required|array|min:1', 'rows.*.index' => 'required|integer|min:0', 'rows.*.action' => 'required|in:import,skip', 'rows.*.name' => 'nullable|string|max:191']);
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

    /**
     * POST /api/teacher-imports/preview
     *
     * Reads an assignment workbook and returns, per trainer, the modules and
     * groups found in it, matched against existing accounts and groups.
     * Nothing is written except the short-lived import batch.
     */
    public function previewTeachers(Request $request, AssignmentWorkbookReader $reader)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Only administrators can import trainers.'], 403);
        $request->validate(['file' => 'required|file|max:20480|mimes:xlsx,csv,txt']);

        try {
            $preview = $reader->read($request->file('file'));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $batch = $this->batch($request, 'teacher', $preview);

        return response()->json(['data' => $preview + [
            'batch_id' => $batch->id,
            'expires_at' => $batch->expires_at->toISOString(),
        ]]);
    }

    /**
     * POST /api/teacher-imports/{batch}/commit
     *
     * Creates the accounts the admin kept, every group listed in the file
     * (empty, ready for a student list), and each trainer's modules. Safe to
     * run on the same file twice: existing trainers, groups and modules are
     * reused, never duplicated.
     */
    public function commitTeachers(Request $request, ImportBatch $batch)
    {
        if ($request->user()->role !== 'admin' || !$this->available($request, $batch, 'teacher')) {
            return response()->json(['message' => 'Forbidden or expired import preview.'], 403);
        }

        $data = $request->validate([
            'trainers' => 'required|array|min:1',
            'trainers.*.index' => 'required|integer|min:0',
            'trainers.*.action' => 'required|in:import,skip',
            'trainers.*.first_name' => 'nullable|string|max:100',
            'trainers.*.last_name' => 'nullable|string|max:100',
        ]);

        $preview = $batch->payload['rows'] ?? [];
        $sourceTrainers = collect($preview['trainers'] ?? [])->keyBy('index');
        $instructions = collect($data['trainers'])->keyBy('index');
        $academicYear = $preview['academic_year'] ?? null;
        $credentials = [];

        try {
            $result = DB::transaction(function () use ($preview, $sourceTrainers, $instructions, $academicYear, $batch, &$credentials) {
                $summary = [
                    'created' => 0, 'linked' => 0, 'skipped' => 0,
                    'groups_created' => 0, 'groups_reused' => 0, 'groups_archived' => [],
                    'modules_created' => 0, 'group_links' => 0,
                ];

                // 1. Every class in the workbook becomes a group, so its student
                //    list can be uploaded later from the Groups page.
                $groupsByKey = [];
                $existingGroups = Group::query()->get()->keyBy(fn (Group $group) => mb_strtoupper(trim($group->name)));
                foreach ($preview['groups'] ?? [] as $entry) {
                    $key = mb_strtoupper(trim($entry['name']));
                    $group = $existingGroups->get($key);

                    if ($group && ($group->status ?? 'active') === 'archived') {
                        // An archived group keeps its history; we do not revive it silently.
                        $summary['groups_archived'][] = $group->name;
                        continue;
                    }

                    if (!$group) {
                        $degree = $entry['degree'] ?: 'Non précisé';
                        $group = Group::create([
                            'name' => mb_substr(trim($entry['name']), 0, 50),
                            'level' => mb_substr($degree, 0, 50),
                            'degree' => mb_substr($degree, 0, 80),
                            'study_year' => $entry['study_year'],
                            'academic_year' => $academicYear,
                            'status' => 'active',
                        ]);
                        $summary['groups_created']++;
                    } else {
                        $summary['groups_reused']++;
                    }

                    $groupsByKey[$key] = $group->id;
                }

                // 2. Trainers. Every new account starts with the same temporary
                //    password (changed at first login), so it is hashed once:
                //    bcrypt costs ~0.3 s a call, which for a whole workbook
                //    would push the request past PHP's 30 s limit.
                $temporaryHash = Hash::make(TeacherController::DEFAULT_PASSWORD);
                $now = now();

                foreach ($sourceTrainers as $index => $trainer) {
                    $instruction = $instructions->get($index, ['action' => 'skip']);
                    if ($instruction['action'] === 'skip') { $summary['skipped']++; continue; }

                    $teacher = !empty($trainer['existing_teacher_id'])
                        ? Teacher::with('user')->find($trainer['existing_teacher_id'])
                        : null;

                    if ($teacher) {
                        $summary['linked']++;
                    } else {
                        $firstName = trim($instruction['first_name'] ?? $trainer['first_name'] ?? '');
                        $lastName = trim($instruction['last_name'] ?? $trainer['last_name'] ?? '');
                        if ($firstName === '' || $lastName === '') {
                            throw new RuntimeException("Le formateur « {$trainer['source_name']} » doit avoir un prénom et un nom.");
                        }

                        $email = SchoolEmail::generate($firstName, $lastName);
                        $user = User::create([
                            'first_name' => $firstName,
                            'last_name' => $lastName,
                            'email' => $email,
                            'password' => $temporaryHash,
                            'role' => 'teacher',
                            'is_active' => true,
                            'must_change_password' => true,
                        ]);
                        $teacher = Teacher::create(['user_id' => $user->id]);
                        $teacher->setRelation('user', $user);
                        $credentials[] = [
                            'name' => "{$firstName} {$lastName}",
                            'email' => $email,
                            'temporary_password' => TeacherController::DEFAULT_PASSWORD,
                        ];
                        $summary['created']++;
                    }

                    // Groups: add, never replace what the admin assigned by hand.
                    $groupIds = collect($trainer['groups'] ?? [])
                        ->map(fn ($name) => $groupsByKey[mb_strtoupper(trim($name))] ?? null)
                        ->filter()->unique()->values()->all();
                    $attached = $teacher->groups()->syncWithoutDetaching($groupIds);
                    $summary['group_links'] += count($attached['attached']);

                    // Modules (matières): one per distinct name for this trainer,
                    // written in a single insert.
                    $ownModules = $teacher->modules()->pluck('name')->map(fn ($name) => mb_strtolower($name))->flip();
                    $newModules = [];
                    foreach ($trainer['modules'] ?? [] as $module) {
                        $name = trim($module['name'] ?? '');
                        if ($name === '' || $ownModules->has(mb_strtolower($name))) continue;
                        $ownModules->put(mb_strtolower($name), true);
                        $newModules[] = ['teacher_id' => $teacher->id, 'name' => $name, 'created_at' => $now, 'updated_at' => $now];
                    }
                    if ($newModules !== []) {
                        Module::insert($newModules);
                        $summary['modules_created'] += count($newModules);
                    }
                }

                $batch->update(['payload' => [], 'committed_at' => now()]);
                return $summary;
            });
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        AuditLogger::record(
            $request->user(),
            'teachers.imported',
            'Imported trainers from an assignment workbook.',
            null,
            collect($result)->except('groups_archived')->all()
        );

        return response()->json(['data' => $result + ['credentials' => $credentials]]);
    }

    /**
     * POST /api/student-list-imports/preview
     *
     * Reads the institution's student export, where every row names the
     * student's group (CodeDiplome), and returns the groups and students it
     * would create or update. Nothing is written except the import batch.
     */
    public function previewStudentList(Request $request, StudentListReader $reader)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Only administrators can import student lists.'], 403);
        // The official export is an XML spreadsheet named .xls, so the reader
        // goes by the file's content rather than its guessed MIME type.
        $request->validate(['file' => 'required|file|max:20480|extensions:xls,xlsx,xml,csv,txt']);

        try {
            $preview = $reader->read($request->file('file'));
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $batch = $this->batch($request, 'student_list', $preview);

        return response()->json(['data' => $preview + [
            'batch_id' => $batch->id,
            'expires_at' => $batch->expires_at->toISOString(),
        ]]);
    }

    /**
     * POST /api/student-list-imports/{batch}/commit
     *
     * Creates the missing groups, an account for every new student, and adds
     * each student to the group the file names. Students keep the groups they
     * already had, archived groups are left alone, and repeating the import
     * changes nothing.
     */
    public function commitStudentList(Request $request, ImportBatch $batch)
    {
        if ($request->user()->role !== 'admin' || !$this->available($request, $batch, 'student_list')) {
            return response()->json(['message' => 'Forbidden or expired import preview.'], 403);
        }

        $data = $request->validate([
            'exclude_groups' => 'array',
            'exclude_groups.*' => 'string|max:60',
        ]);

        $preview = $batch->payload['rows'] ?? [];
        $excluded = array_flip($data['exclude_groups'] ?? []);
        $credentials = [];

        try {
            $result = DB::transaction(function () use ($preview, $excluded, $batch, &$credentials) {
                $summary = [
                    'students_created' => 0, 'students_added' => 0, 'students_unchanged' => 0, 'skipped' => 0,
                    'groups_created' => 0, 'groups_reused' => 0, 'groups_archived' => [],
                ];
                $now = now();

                // 1. Groups: reuse the ones that exist, create the others.
                $groupIds = [];
                $groupNames = [];
                $existingGroups = Group::query()->get()->keyBy(fn (Group $group) => StudentListReader::groupKey($group->name));
                foreach ($preview['groups'] ?? [] as $entry) {
                    if (isset($excluded[$entry['key']])) continue;
                    $group = $existingGroups->get($entry['key']);

                    if ($group && ($group->status ?? 'active') === 'archived') {
                        $summary['groups_archived'][] = $group->name;
                        continue;
                    }

                    if (!$group) {
                        $group = Group::create([
                            'name' => $entry['name'],
                            'level' => mb_substr($entry['degree'], 0, 50),
                            'degree' => mb_substr($entry['degree'], 0, 80),
                            'study_year' => $entry['study_year'],
                            'academic_year' => $entry['academic_year'] ?? $preview['academic_year'],
                            'status' => 'active',
                        ]);
                        $summary['groups_created']++;
                    } else {
                        $summary['groups_reused']++;
                    }

                    $groupIds[$entry['key']] = $group->id;
                    $groupNames[$group->id] = $group->name;
                }

                // 2. Match students again: the preview can be up to an hour old.
                $rows = collect($preview['students'] ?? []);
                $students = $rows->filter(fn ($student) => isset($groupIds[$student['group']]));
                $summary['skipped'] = $rows->count() - $students->count();

                $existing = $students->flatMap(fn ($student) => [$student['cin'], $student['matricule']])->filter()->unique()->chunk(500)
                    ->flatMap(fn ($chunk) => Student::query()->whereIn('cne', $chunk->values())->get(['id', 'cne']))
                    ->keyBy('cne');
                $memberships = $existing->pluck('id')->chunk(500)
                    ->flatMap(fn ($ids) => DB::table('group_students')->whereIn('student_id', $ids->values())->get(['student_id', 'group_id']))
                    ->mapWithKeys(fn ($row) => ["{$row->student_id}:{$row->group_id}" => true]);

                // 3. Existing students join their group from the file.
                $newStudents = [];
                $joins = [];
                $legacyGroups = [];
                $seen = [];
                foreach ($students as $student) {
                    $groupId = $groupIds[$student['group']];
                    $match = ($student['cin'] !== '' ? $existing->get($student['cin']) : null)
                        ?? ($student['matricule'] !== '' ? $existing->get($student['matricule']) : null);

                    if (!$match) { $newStudents[] = $student + ['group_id' => $groupId]; continue; }
                    if (isset($seen[$match->id])) { $summary['skipped']++; continue; }
                    $seen[$match->id] = true;

                    // The legacy single-group column follows the most recent group.
                    $legacyGroups[$groupId][] = $match->id;
                    if ($memberships->has("{$match->id}:{$groupId}")) { $summary['students_unchanged']++; continue; }
                    $joins[] = ['group_id' => $groupId, 'student_id' => $match->id, 'joined_at' => $now, 'created_at' => $now, 'updated_at' => $now];
                    $summary['students_added']++;
                }

                foreach ($legacyGroups as $groupId => $ids) {
                    foreach (array_chunk($ids, 500) as $chunk) Student::whereIn('id', $chunk)->update(['group_id' => $groupId]);
                }
                foreach (array_chunk($joins, 100) as $chunk) DB::table('group_students')->insert($chunk);

                // 4. New students, written in bulk. They all start with the
                //    default temporary password, hashed once: bcrypt per account
                //    would take minutes for a whole school.
                $passwordHash = Hash::make(TeacherController::DEFAULT_PASSWORD);
                $takenEmails = User::query()->pluck('email')->mapWithKeys(fn ($email) => [mb_strtolower($email) => true])->all();
                foreach ($newStudents as &$student) {
                    $student['email'] = SchoolEmail::generateAvoiding($student['first_name'], $student['last_name'], $takenEmails);
                }
                unset($student);

                foreach (array_chunk($newStudents, 100) as $chunk) {
                    DB::table('users')->insert(array_map(fn ($student) => [
                        'first_name' => $student['first_name'],
                        'last_name' => $student['last_name'],
                        'email' => $student['email'],
                        'password' => $passwordHash,
                        'role' => 'student',
                        'is_active' => true,
                        'must_change_password' => true,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ], $chunk));
                    $userIds = User::whereIn('email', array_column($chunk, 'email'))->pluck('id', 'email');

                    DB::table('students')->insert(array_map(fn ($student) => [
                        'user_id' => $userIds[$student['email']],
                        'cne' => $student['cne'],
                        'group_id' => $student['group_id'],
                        'created_at' => $now,
                        'updated_at' => $now,
                    ], $chunk));
                    $studentIds = Student::whereIn('cne', array_column($chunk, 'cne'))->pluck('id', 'cne');

                    DB::table('group_students')->insert(array_map(fn ($student) => [
                        'group_id' => $student['group_id'],
                        'student_id' => $studentIds[$student['cne']],
                        'joined_at' => $now,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ], $chunk));

                    foreach ($chunk as $student) {
                        $credentials[] = [
                            'name' => "{$student['last_name']} {$student['first_name']}",
                            'group' => $groupNames[$student['group_id']],
                            'email' => $student['email'],
                            'temporary_password' => TeacherController::DEFAULT_PASSWORD,
                        ];
                    }
                }
                $summary['students_created'] = count($newStudents);

                $batch->update(['payload' => [], 'committed_at' => now()]);
                return $summary;
            });
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        AuditLogger::record(
            $request->user(),
            'students.list_imported',
            'Imported the institution student list.',
            null,
            collect($result)->except('groups_archived')->all()
        );

        return response()->json(['data' => $result + ['credentials' => $credentials]]);
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
