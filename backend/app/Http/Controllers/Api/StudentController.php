<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\StudentResource;
use App\Mail\WelcomeMail;
use App\Models\Student;
use App\Models\User;
use App\Services\SchoolEmail;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;

class StudentController extends Controller
{
    /** GET /api/students */
    public function index()
    {
        if (request()->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $students = Student::with(['user', 'group'])->withAttendanceTotals()->get();
        return StudentResource::collection($students);
    }

    /** GET /api/students/{id}/stats */
    public function stats(Request $request, Student $student)
    {
        $user = $request->user();

        if ($user->role === 'student' && (int) $user->student->id !== (int) $student->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if ($user->role === 'teacher') {
            if (!$user->teacher) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
            $allowedGroupIds = $user->teacher->groups()->where('groups.status', 'active')->pluck('groups.id');
            if (!$student->groups()->whereIn('groups.id', $allowedGroupIds)->exists()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $student->load(['user', 'group']);

        $records = $student->absences()->with('group')->where('status', '!=', 'voided')->get();
        $absent = $records->where('attendance_status', 'absent');
        $late = $records->where('attendance_status', 'late');

        $absenceHours = (float) $absent->sum('hours');
        $justifiedHours = (float) $absent->where('status', 'justified')->sum('hours');
        $unjustifiedHours = (float) $absent->where('status', 'unjustified')->sum('hours');
        $pendingHours = (float) $absent->where('status', 'pending')->sum('hours');

        // Attendance rate across every session the student was recorded in.
        $sessions = $records->count();
        $attended = $records->whereIn('attendance_status', ['present', 'late', 'excused'])->count();
        $attendanceRate = $sessions > 0 ? round(($attended / $sessions) * 100, 1) : 100.0;

        // Last 6 months of absence hours, oldest first, for the trend chart.
        $monthly = collect(range(5, 0))->map(function (int $offset) use ($absent) {
            $month = now()->startOfMonth()->subMonths($offset);
            $prefix = $month->format('Y-m');
            return [
                'month' => $prefix,
                'label' => $month->format('M'),
                'hours' => (float) $absent->filter(fn ($record) => str_starts_with((string) $record->date, $prefix))->sum('hours'),
            ];
        })->values();

        // Which weekday the student misses most often.
        $byWeekday = $absent->groupBy(fn ($record) => Carbon::parse($record->date)->format('l'))
            ->map(fn ($group) => $group->count())
            ->sortDesc();

        return response()->json(['data' => [
            'student' => new StudentResource($student),
            'absence_hours' => $absenceHours,
            'justified_hours' => $justifiedHours,
            'unjustified_hours' => $unjustifiedHours,
            'pending_hours' => $pendingHours,
            'absence_count' => $absent->count(),
            'late_count' => $late->count(),
            'late_minutes' => (int) $late->sum('late_minutes'),
            'session_count' => $sessions,
            'attendance_rate' => $attendanceRate,
            'threshold_hours' => 48,
            'monthly' => $monthly,
            'worst_weekday' => $byWeekday->keys()->first(),
            'recent' => $records->sortByDesc('date')->take(10)->values()->map(fn ($record) => [
                'id' => $record->id,
                'date' => Carbon::parse($record->date)->toDateString(),
                'hours' => (float) $record->hours,
                'attendance_status' => $record->attendance_status,
                'status' => $record->status,
                'late_minutes' => (int) $record->late_minutes,
                'group_name' => optional($record->group)->name ?? '',
            ]),
        ]]);
    }

    /** POST /api/students */
    public function store(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'first_name' => 'required|string|max:100',
            'last_name'  => 'required|string|max:100',
            'cne'        => 'required|string|max:20|unique:students,cne',
            'phone'      => 'nullable|string|max:20',
            'group_id'   => 'required|exists:groups,id,status,active',
        ]);

        return DB::transaction(function () use ($data) {
            $email = SchoolEmail::generate($data['first_name'], $data['last_name']);
            $defaultPassword = 'password123';

            $user = User::create([
                'first_name' => $data['first_name'],
                'last_name'  => $data['last_name'],
                'email'      => $email,
                'password'   => Hash::make($defaultPassword), // default password
                'role'       => 'student',
                'must_change_password' => true,
            ]);

            $student = Student::create([
                'user_id'  => $user->id,
                'cne'      => $data['cne'],
                'phone'    => $data['phone'] ?? null,
                'group_id' => $data['group_id'],
            ]);
            $student->groups()->syncWithoutDetaching([$data['group_id']]);

            $student->load(['user', 'group']);

            // Send welcome email
            try {
                Mail::to($user->email)->send(new WelcomeMail($user, $defaultPassword));
            } catch (\Throwable $e) {
                \Log::warning('Failed to send welcome email: ' . $e->getMessage());
            }

            return response()->json([
                'data' => new StudentResource($student),
                'credentials' => [
                    'email' => $email,
                    'password' => $defaultPassword,
                ],
            ]);
        });
    }

    /** PUT /api/students/{id} */
    public function update(Request $request, Student $student)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'first_name' => 'sometimes|string|max:100',
            'last_name'  => 'sometimes|string|max:100',
            'cne'        => 'sometimes|string|max:20|unique:students,cne,' . $student->id,
            'phone'      => 'nullable|string|max:20',
            'group_id'   => 'sometimes|exists:groups,id,status,active',
        ]);

        DB::transaction(function () use ($student, $data) {
            $student->user->update(collect($data)->only(['first_name', 'last_name'])->toArray());
            $student->update(collect($data)->only(['cne', 'phone', 'group_id'])->toArray());
            if (isset($data['group_id'])) $student->groups()->syncWithoutDetaching([$data['group_id']]);
        });

        $student->load(['user', 'group']);
        return new StudentResource($student);
    }

    /** DELETE /api/students/{id} */
    public function destroy(Student $student)
    {
        if (request()->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $student->user->delete(); // cascades to student
        return response()->noContent();
    }

    /** DELETE /api/students-bulk */
    public function bulkDestroy(Request $request)
    {
        if ($request->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $data = $request->validate([
            'student_ids' => 'required|array|min:1',
            'student_ids.*' => 'integer|distinct|exists:students,id',
        ]);

        $deleted = DB::transaction(function () use ($data) {
            $students = Student::with('user')->whereIn('id', $data['student_ids'])->get();
            foreach ($students as $student) {
                $student->user->delete();
            }

            return $students->count();
        });

        return response()->json(['data' => ['deleted' => $deleted]]);
    }
}
