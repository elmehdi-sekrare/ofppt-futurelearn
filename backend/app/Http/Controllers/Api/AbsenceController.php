<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\AbsenceResource;
use App\Mail\AbsenceMarkedMail;
use App\Mail\AbsenceThresholdMail;
use App\Models\Absence;
use App\Models\Notification;
use App\Models\Student;
use App\Models\User;
use App\Models\Module;
use App\Models\Group;
use App\Services\AttendanceRiskService;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;

class AbsenceController extends Controller
{
    /** GET /api/absences/student-history/{student} */
    public function studentHistory(Request $request, Student $student)
    {
        $user = $request->user();

        if ($user->role === 'student') {
            if ((int) $user->student->id !== (int) $student->id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } elseif ($user->role === 'teacher') {
            if (!$user->teacher) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            $allowedGroupIds = $user->teacher->groups()->where('groups.status', 'active')->pluck('groups.id');
            if (!$student->groups()->whereIn('groups.id', $allowedGroupIds)->exists()) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        }

        $absences = Absence::with(['student.user', 'teacher.user', 'group'])
            ->where('student_id', $student->id)
            ->when($user->role === 'teacher', fn ($query) => $query->whereIn('group_id', $allowedGroupIds))
            ->orderByDesc('date')
            ->orderByDesc('created_at')
            ->get();

        return AbsenceResource::collection($absences);
    }

    /** GET /api/absences */
    public function index(Request $request)
    {
        $query = Absence::with(['student.user', 'teacher.user', 'group']);

        $user = $request->user();
        $requestedStudentRaw = $request->input('student_id');
        $hasRequestedStudent = $request->exists('student_id') && $requestedStudentRaw !== '';
        $requestedStudentId = null;

        if ($hasRequestedStudent) {
            $requestedStudentId = (int) $requestedStudentRaw;
            Validator::make(
                ['student_id' => $requestedStudentRaw],
                ['student_id' => 'integer|exists:students,id']
            )->validate();
        }

        if ($user->role === 'student') {
            $query->where('student_id', $user->student->id)->where('status', '!=', 'voided');
            if ($hasRequestedStudent && (int) $requestedStudentId !== (int) $user->student->id) {
                return response()->json(['message' => 'Forbidden'], 403);
            }
        } elseif ($user->role === 'teacher') {
            if (!$user->teacher) {
                return response()->json(['message' => 'Forbidden'], 403);
            }

            if ($hasRequestedStudent) {
                $student = Student::query()->select(['id', 'group_id'])->find($requestedStudentId);
                $allowedGroupIds = $user->teacher->groups()->where('groups.status', 'active')->pluck('groups.id');

                if (!$student || !$student->groups()->whereIn('groups.id', $allowedGroupIds)->exists()) {
                    return response()->json(['message' => 'Forbidden'], 403);
                }

                $query->where('student_id', $requestedStudentId)->whereIn('group_id', $allowedGroupIds);
            } else {
                $query->where('teacher_id', $user->teacher->id);
            }
        } elseif ($hasRequestedStudent) {
            $query->where('student_id', $requestedStudentId);
        }

        if ($request->filled('group')) {
            $query->whereHas('group', fn ($q) => $q->where('name', $request->group));
        }
        if ($request->filled('status')) {
            $statuses = explode(',', $request->status);
            $query->whereIn('status', $statuses);
        } elseif ($user->role === 'admin') {
            $query->where('status', '!=', 'voided');
        }
        if ($request->filled('attendance_status')) {
            $query->whereIn('attendance_status', explode(',', $request->attendance_status));
        } elseif ($user->role === 'admin') {
            // Default to real absences only so present/late/excused records
            // are not shown unless the admin explicitly asks for them.
            $query->where('attendance_status', 'absent');
        }
        if ($request->filled('date')) {
            $query->whereDate('date', $request->date);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($query) use ($search) {
                $query->whereHas('student.user', function ($q) use ($search) {
                    $q->where('first_name', 'like', "%{$search}%")
                        ->orWhere('last_name', 'like', "%{$search}%");
                })->orWhere('subject', 'like', "%{$search}%")
                    ->orWhereHas('teacher.user', function ($q) use ($search) {
                        $q->where('first_name', 'like', "%{$search}%")
                            ->orWhere('last_name', 'like', "%{$search}%");
                    });
            });
        }

        $sort = $request->get('sort', 'latest');
        $query->orderBy('date', $sort === 'latest' ? 'desc' : 'asc');

        if ($request->filled('limit')) {
            $query->limit((int) $request->limit);
        }

        return AbsenceResource::collection($query->get());
    }

    /** PATCH /api/absences/{absence}/resolve */
    public function resolve(Request $request, Absence $absence)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Forbidden'], 403);
        // Allow resolving both absent and late attendance records (paper-based workflow:
        // a student brings a real paper and the admin updates the record directly).
        if (!in_array($absence->attendance_status, ['absent', 'late'])) {
            return response()->json(['message' => 'Only absent or late attendance records can be resolved.'], 422);
        }

        $data = $request->validate([
            'action' => 'required|in:justified,unjustified,voided',
            'note' => 'required|string|max:500',
        ]);

        $absence->update([
            'status' => $data['action'],
            'resolution_source' => 'admin',
            'resolution_note' => $data['note'],
            'resolved_by' => $request->user()->id,
            'resolved_at' => now(),
        ]);

        AuditLogger::record($request->user(), 'absence.' . $data['action'], 'Admin marked an absence as ' . $data['action'] . '.', $absence, ['note' => $data['note']]);
        return new AbsenceResource($absence->load(['student.user', 'teacher.user', 'group']));
    }

    /** POST /api/absences */
    public function store(Request $request)
    {
        $data = $request->validate([
            'student_ids'   => 'required_without:attendance_records|array|min:1',
            'student_ids.*' => 'exists:students,id',
            'attendance_records' => 'required_without:student_ids|array|min:1',
            'attendance_records.*.student_id' => 'required|integer|exists:students,id',
            'attendance_records.*.attendance_status' => 'required|in:present,late,absent,excused',
            'attendance_records.*.late_minutes' => 'nullable|integer|min:1|max:480',
            'group_id'      => 'required|exists:groups,id',
            'date'          => 'required|date',
            'start_time'    => 'required|date_format:H:i',
            'end_time'      => 'required|date_format:H:i|after:start_time',
            'module_id'     => 'required|integer|exists:modules,id',
            'notes'         => 'nullable|string',
        ]);

        $user = $request->user();
        $teacher = $user->teacher;
        if ($user->role !== 'teacher' || !$teacher || !Group::whereKey($data['group_id'])->where('status', 'active')->exists() || !$teacher->groups()->whereKey($data['group_id'])->where('groups.status', 'active')->exists()) {
            return response()->json(['message' => 'Forbidden'], 403);
        }
        $module = Module::whereKey($data['module_id'])->where('teacher_id', $teacher->id)->first();
        if (!$module) {
            return response()->json(['message' => 'Select one of your own modules.'], 422);
        }

        // Legacy clients may still submit student_ids; treat them as absences.
        $attendanceRecords = $data['attendance_records'] ?? collect($data['student_ids'])->map(fn ($studentId) => [
            'student_id' => $studentId,
            'attendance_status' => 'absent',
        ])->all();
        $studentIds = collect($attendanceRecords)->pluck('student_id');

        if ($studentIds->unique()->count() !== $studentIds->count()) {
            return response()->json(['message' => 'Each student can only be recorded once per attendance session.'], 422);
        }
        if (Student::whereIn('id', $studentIds)->whereHas('groups', fn ($query) => $query->whereKey($data['group_id']))->count() !== $studentIds->count()) {
            return response()->json(['message' => 'All attendance records must belong to the selected group.'], 422);
        }

        $absenceIds = DB::transaction(function () use ($attendanceRecords, $data, $teacher, $module) {
            return collect($attendanceRecords)->map(function (array $record) use ($data, $teacher, $module) {
                $attendanceStatus = $record['attendance_status'];
                return Absence::create([
                    'student_id' => $record['student_id'],
                    'teacher_id' => $teacher->id,
                    'module_id'  => $module->id,
                    'group_id'   => $data['group_id'],
                    'date'       => $data['date'],
                    'start_time' => $data['start_time'],
                    'end_time'   => $data['end_time'],
                    'subject'    => $module->name,
                    'notes'      => $data['notes'] ?? null,
                    'status' => $attendanceStatus === 'excused' ? 'justified' : 'pending',
                    'attendance_status' => $attendanceStatus,
                    'late_minutes' => $attendanceStatus === 'late' ? ($record['late_minutes'] ?? 10) : 0,
                    'hours' => $attendanceStatus === 'absent' ? null : 0,
                ])->id;
            })->all();
        });

        $absences = Absence::with(['student.user', 'teacher.user', 'group'])
            ->whereIn('id', $absenceIds)
            ->get();

        $teacherName = $teacher->user->first_name . ' ' . $teacher->user->last_name;

        $adminUsers = User::where('role', 'admin')->get();
        foreach ($absences as $absence) {
            $studentName = $absence->student->user->first_name . ' ' . $absence->student->user->last_name;

            AuditLogger::record(
                $user,
                'attendance.marked',
                $teacherName . ' marked ' . $studentName . ' as ' . $absence->attendance_status . ' for ' . $absence->subject . '.',
                $absence,
                ['attendance_status' => $absence->attendance_status, 'late_minutes' => $absence->late_minutes]
            );

            if ($absence->attendance_status === 'present') continue;

            if ($absence->attendance_status === 'late') {
                Notification::create([
                    'user_id' => $absence->student->user_id,
                    'title' => 'Late arrival recorded',
                    'message' => $teacherName . ' recorded you ' . $absence->late_minutes . ' minutes late for ' . $absence->subject . ' on ' . $absence->date . '.',
                    'type' => 'warning',
                ]);
                AttendanceRiskService::notifyAdminsIfTriggered($absence->student, $user);
                continue;
            }

            if ($absence->attendance_status === 'excused') {
                Notification::create([
                    'user_id' => $absence->student->user_id,
                    'title' => 'Excused attendance',
                    'message' => $teacherName . ' marked your attendance as excused for ' . $absence->subject . ' on ' . $absence->date . '.',
                    'type' => 'info',
                ]);
                continue;
            }

            foreach ($adminUsers as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'title' => 'New Absence Recorded',
                    'message' => $teacherName . ' marked ' . $studentName . ' absent for ' . $absence->subject . '.',
                    'type' => 'warning',
                ]);
            }

            Notification::create([
                'user_id' => $absence->student->user_id,
                'title' => 'Absence Recorded',
                'message' => $teacherName . ' marked you absent for ' . $absence->subject . ' on ' . $absence->date . '.',
                'type' => 'error',
            ]);

            try {
                Mail::to($absence->student->user->email)
                    ->send(new AbsenceMarkedMail($absence));
            } catch (\Throwable $e) {
                \Log::error('Absence email failed to ' . $absence->student->user->email . ': ' . $e->getMessage());
            }

            try {
                $student = $absence->student;
                $totalAbsences = Absence::where('student_id', $student->id)->where('attendance_status', 'absent')->where('status', '!=', 'voided')->count();

                if ($totalAbsences >= 3 && ($totalAbsences === 3 || $totalAbsences % 5 === 0)) {
                    $totalHours = Absence::where('student_id', $student->id)->where('attendance_status', 'absent')->where('status', '!=', 'voided')->sum('hours');
                    $unjustifiedCount = Absence::where('student_id', $student->id)
                        ->where('attendance_status', 'absent')
                        ->where('status', '!=', 'voided')
                        ->where('status', '!=', 'justified')
                        ->count();

                    Mail::to($student->user->email)
                        ->send(new AbsenceThresholdMail(
                            $student,
                            $totalAbsences,
                            $totalHours,
                            $unjustifiedCount,
                            'student',
                            $student->user->first_name . ' ' . $student->user->last_name
                        ));

                    foreach ($adminUsers as $admin) {
                        Mail::to($admin->email)
                            ->send(new AbsenceThresholdMail(
                                $student,
                                $totalAbsences,
                                $totalHours,
                                $unjustifiedCount,
                                'admin',
                                $admin->first_name . ' ' . $admin->last_name
                            ));
                    }
                }
            } catch (\Throwable $e) {
                \Log::warning('Failed to send threshold alert: ' . $e->getMessage());
            }

            AttendanceRiskService::notifyAdminsIfTriggered($absence->student, $user);
        }

        return AbsenceResource::collection($absences)->response()->setStatusCode(201);
    }

    /** DELETE /api/absences/{absence} */
    public function destroy(Request $request, Absence $absence)
    {
        $user = $request->user();

        // Admins may remove any absence record (paper-based workflow).
        // A teacher may correct only attendance records that they created.
        $isAdmin = $user->role === 'admin';
        $isOwnTeacher = $user->role === 'teacher' && $user->teacher && (int) $absence->teacher_id === (int) $user->teacher->id;
        if (!$isAdmin && !$isOwnTeacher) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $studentName = $absence->student->user->first_name . ' ' . $absence->student->user->last_name;
        AuditLogger::record($user, 'attendance.removed', $user->first_name . ' ' . $user->last_name . " removed " . $studentName . "'s " . $absence->attendance_status . ' record.', $absence);
        $absence->delete();

        // The related justification is removed by the database foreign-key cascade.
        return response()->noContent();
    }
}
