<?php

namespace Tests\Feature;

use App\Models\Absence;
use App\Models\AuditLog;
use App\Models\Group;
use App\Models\Justification;
use App\Models\Module;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AttendanceWorkflowTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_save_a_full_attendance_session_with_each_status(): void
    {
        $group = $this->group();
        $teacher = $this->teacher($group, 'teacher@ofppt.test');
        $module = Module::create(['teacher_id' => $teacher->id, 'name' => 'Web Development']);
        $students = collect(range(1, 4))->map(fn ($number) => $this->student($group, "student{$number}@ofppt.test"));
        Sanctum::actingAs($teacher->user);

        $response = $this->postJson('/api/absences', [
            'attendance_records' => [
                ['student_id' => $students[0]->id, 'attendance_status' => 'present'],
                ['student_id' => $students[1]->id, 'attendance_status' => 'late', 'late_minutes' => 15],
                ['student_id' => $students[2]->id, 'attendance_status' => 'absent'],
                ['student_id' => $students[3]->id, 'attendance_status' => 'excused'],
            ],
            'group_id' => $group->id,
            'date' => now()->toDateString(),
            'start_time' => '08:30',
            'end_time' => '10:30',
            'module_id' => $module->id,
        ]);

        $response->assertCreated()->assertJsonCount(4, 'data');
        $this->assertDatabaseHas('absences', ['student_id' => $students[0]->id, 'attendance_status' => 'present', 'hours' => 0]);
        $this->assertDatabaseHas('absences', ['student_id' => $students[1]->id, 'attendance_status' => 'late', 'late_minutes' => 15, 'hours' => 0]);
        $this->assertDatabaseHas('absences', ['student_id' => $students[2]->id, 'attendance_status' => 'absent', 'hours' => 2]);
        $this->assertDatabaseHas('absences', ['student_id' => $students[3]->id, 'attendance_status' => 'excused', 'status' => 'justified', 'hours' => 0]);
        $this->assertDatabaseCount('audit_logs', 4);
    }

    public function test_admin_receives_a_risk_alert_after_three_recent_absences(): void
    {
        $group = $this->group();
        $teacher = $this->teacher($group, 'teacher@ofppt.test');
        $module = Module::create(['teacher_id' => $teacher->id, 'name' => 'Web Development']);
        $student = $this->student($group, 'student@ofppt.test');
        $admin = User::create(['first_name' => 'Admin', 'last_name' => 'Test', 'email' => 'admin@ofppt.test', 'password' => 'password123', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($teacher->user);

        foreach ([0, 1, 2] as $offset) {
            $this->postJson('/api/absences', [
                'student_ids' => [$student->id],
                'group_id' => $group->id,
                'date' => now()->subDays($offset)->toDateString(),
                'start_time' => '08:30',
                'end_time' => '10:30',
                'module_id' => $module->id,
            ])->assertCreated();
        }

        // Raised once in the audit log; admins no longer get notifications.
        $this->assertSame(1, AuditLog::where('event', 'attendance.risk_alert')->where('subject_id', $student->id)->count());
        $this->assertDatabaseMissing('notifications', ['user_id' => $admin->id]);
        Sanctum::actingAs($admin);
        $this->getJson('/api/dashboard/risk')->assertOk()->assertJsonPath('data.0.risk_level', 'high');
    }

    public function test_admin_can_resolve_an_absence_without_a_student_upload(): void
    {
        $group = $this->group();
        $teacher = $this->teacher($group, 'teacher-paper@ofppt.test');
        $module = Module::create(['teacher_id' => $teacher->id, 'name' => 'Databases']);
        $student = $this->student($group, 'student-paper@ofppt.test');
        $admin = User::create(['first_name' => 'Admin', 'last_name' => 'Paper', 'email' => 'admin-paper@ofppt.test', 'password' => 'password123', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($teacher->user);

        $absence = $this->postJson('/api/absences', [
            'attendance_records' => [['student_id' => $student->id, 'attendance_status' => 'absent']],
            'group_id' => $group->id,
            'date' => now()->toDateString(),
            'start_time' => '08:30',
            'end_time' => '10:30',
            'module_id' => $module->id,
        ])->assertCreated()->json('data.0.id');

        Sanctum::actingAs($admin);
        $this->patchJson("/api/absences/{$absence}/resolve", ['action' => 'justified', 'note' => 'Paper certificate received.'])
            ->assertOk()
            ->assertJsonPath('data.status', 'justified')
            ->assertJsonPath('data.resolution_source', 'admin');

        $this->assertDatabaseHas('absences', ['id' => $absence, 'status' => 'justified', 'resolution_source' => 'admin', 'resolved_by' => $admin->id]);
    }

    public function test_absence_listing_can_filter_late_records_separately(): void
    {
        $group = $this->group();
        $teacher = $this->teacher($group, 'teacher-late@ofppt.test');
        $module = Module::create(['teacher_id' => $teacher->id, 'name' => 'Networks']);
        $student = $this->student($group, 'student-late@ofppt.test');
        Sanctum::actingAs($teacher->user);

        $this->postJson('/api/absences', [
            'attendance_records' => [['student_id' => $student->id, 'attendance_status' => 'late', 'late_minutes' => 20]],
            'group_id' => $group->id,
            'date' => now()->toDateString(),
            'start_time' => '08:30',
            'end_time' => '10:30',
            'module_id' => $module->id,
        ])->assertCreated();

        $this->getJson('/api/absences?attendance_status=late')->assertOk()->assertJsonCount(1, 'data');
        $this->getJson('/api/absences?attendance_status=absent')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_only_admin_can_review_and_rejection_requires_a_note(): void
    {
        $group = $this->group();
        $teacher = $this->teacher($group, 'teacher@ofppt.test');
        $student = $this->student($group, 'student@ofppt.test');
        $absence = Absence::create(['student_id' => $student->id, 'teacher_id' => $teacher->id, 'group_id' => $group->id, 'date' => now()->toDateString(), 'start_time' => '08:30', 'end_time' => '10:30', 'subject' => 'Web Development']);
        $justification = Justification::create(['absence_id' => $absence->id, 'reason' => 'Medical reason', 'file_name' => 'note.pdf', 'file_path' => 'justifications/note.pdf', 'file_type' => 'pdf']);

        Sanctum::actingAs($teacher->user);
        $this->patchJson("/api/justifications/{$justification->id}/approve")->assertForbidden();

        $admin = User::create(['first_name' => 'Admin', 'last_name' => 'Test', 'email' => 'admin@ofppt.test', 'password' => 'password123', 'role' => 'admin', 'is_active' => true]);
        Sanctum::actingAs($admin);
        $this->patchJson("/api/justifications/{$justification->id}/reject", [])->assertUnprocessable();
        $this->patchJson("/api/justifications/{$justification->id}/reject", ['review_note' => 'Please upload a readable document.'])->assertOk();
        $this->assertDatabaseHas('justifications', ['id' => $justification->id, 'status' => 'rejected']);
    }

    private function group(): Group
    {
        return Group::create(['name' => 'DEV201-A', 'code' => 'DEV201-A', 'level' => '2eme annee']);
    }

    private function teacher(Group $group, string $email): Teacher
    {
        $user = User::create(['first_name' => 'Teacher', 'last_name' => 'Test', 'email' => $email, 'password' => 'password123', 'role' => 'teacher', 'is_active' => true]);
        $teacher = Teacher::create(['user_id' => $user->id]);
        $teacher->groups()->attach($group->id);
        return $teacher->load('user');
    }

    private function student(Group $group, string $email): Student
    {
        $user = User::create(['first_name' => 'Student', 'last_name' => 'Test', 'email' => $email, 'password' => 'password123', 'role' => 'student', 'is_active' => true]);
        return Student::create(['user_id' => $user->id, 'cne' => 'CNE' . random_int(10000, 99999), 'group_id' => $group->id]);
    }
}
