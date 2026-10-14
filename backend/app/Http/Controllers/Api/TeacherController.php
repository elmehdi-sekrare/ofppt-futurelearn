<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\TeacherResource;
use App\Mail\WelcomeMail;
use App\Models\Teacher;
use App\Models\User;
use App\Services\SchoolEmail;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class TeacherController extends Controller
{
    /**
     * Temporary password for new trainer accounts, used by the manual form and
     * the Excel import alike. must_change_password forces a new one at first login.
     */
    public const DEFAULT_PASSWORD = 'password123';

    /** GET /api/teachers */
    public function index()
    {
        if (request()->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $teachers = Teacher::with(['user', 'groups', 'modules'])->get();
        return TeacherResource::collection($teachers);
    }

    /** POST /api/teachers */
    public function store(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name'  => 'required|string|max:100',
            'phone'      => 'nullable|string|max:20',
            'group_ids'  => 'sometimes|array',
            'group_ids.*' => 'integer|exists:groups,id,status,active',
        ]);

        return DB::transaction(function () use ($data) {
            $email = $this->generateSchoolEmail($data['first_name'], $data['last_name']);
            $defaultPassword = self::DEFAULT_PASSWORD;

            $user = User::create([
                'first_name' => $data['first_name'],
                'last_name'  => $data['last_name'],
                'email'      => $email,
                'phone'      => $data['phone'] ?? null,
                'password'   => Hash::make($defaultPassword),
                'role'       => 'teacher',
                'must_change_password' => true,
            ]);

            $teacher = Teacher::create([
                'user_id' => $user->id,
            ]);
            $teacher->groups()->sync($data['group_ids'] ?? []);

            $teacher->load(['user', 'groups']);

            // Send welcome email
            try {
                Mail::to($user->email)->send(new WelcomeMail($user, $defaultPassword));
            } catch (\Throwable $e) {
                \Log::warning('Failed to send welcome email: ' . $e->getMessage());
            }

            return response()->json([
                'data' => new TeacherResource($teacher),
                'credentials' => [
                    'email' => $email,
                    'password' => $defaultPassword,
                ],
            ]);
        });
    }

    /** PUT /api/teachers/{id} */
    public function update(Request $request, Teacher $teacher)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'first_name' => 'sometimes|string|max:100',
            'last_name'  => 'sometimes|string|max:100',
            'phone'      => 'nullable|string|max:20',
            'group_ids'  => 'sometimes|array',
            'group_ids.*' => 'integer|exists:groups,id,status,active',
        ]);

        DB::transaction(function () use ($teacher, $data) {
            $teacher->user->update(collect($data)->only(['first_name', 'last_name', 'phone'])->toArray());
            if (array_key_exists('group_ids', $data)) $teacher->groups()->sync($data['group_ids']);
        });

        $teacher->load(['user', 'groups']);
        return new TeacherResource($teacher);
    }

    /** DELETE /api/teachers/{id} */
    public function destroy(Teacher $teacher)
    {
        if (request()->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $teacher->user->delete();
        return response()->noContent();
    }

    private function generateSchoolEmail(string $firstName, string $lastName): string
    {
        return SchoolEmail::generate($firstName, $lastName);
    }
}
