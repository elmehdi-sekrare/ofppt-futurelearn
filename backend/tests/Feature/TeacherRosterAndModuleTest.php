<?php

namespace Tests\Feature;

use App\Models\Group;
use App\Models\Module;
use App\Models\Absence;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Mail;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TeacherRosterAndModuleTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_create_a_group_and_import_a_csv_roster_with_one_time_credentials(): void
    {
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $groupResponse = $this->postJson('/api/groups', ['name' => 'DEV-200', 'level' => '2ème année']);
        $groupResponse->assertCreated();
        $group = Group::where('name', 'DEV-200')->firstOrFail();

        $file = UploadedFile::fake()->createWithContent('roster.csv', "First name,Last name,CIN\nKamal,Abdelmoula,TA158362\nZakaria,Akil,TA164023\n");
        $preview = $this->post("/api/groups/{$group->id}/student-imports/preview", ['file' => $file], ['Accept' => 'application/json']);
        $preview->assertOk()->assertJsonPath('data.rows.0.status', 'new');

        $batchId = $preview->json('data.batch_id');
        $commit = $this->postJson("/api/student-imports/{$batchId}/commit", ['rows' => [
            ['index' => 0, 'action' => 'import'],
            ['index' => 1, 'action' => 'import'],
        ]]);

        $commit->assertOk()->assertJsonPath('data.created', 2)->assertJsonCount(2, 'data.credentials');
        $this->assertDatabaseHas('students', ['cne' => 'TA158362', 'group_id' => $group->id]);
        $this->assertDatabaseHas('users', ['first_name' => 'Kamal', 'last_name' => 'Abdelmoula', 'must_change_password' => true]);
    }

    public function test_teacher_cannot_create_groups_or_import_rosters(): void
    {
        $teacher = $this->teacher();
        Sanctum::actingAs($teacher->user);

        $this->postJson('/api/groups', ['name' => 'DEV-201', 'level' => '2ème année'])->assertForbidden();
        $myGroup = Group::create(['name' => 'DEV-201', 'level' => '2ème année']);
        $teacher->groups()->attach($myGroup->id);
        $file = UploadedFile::fake()->createWithContent('roster.csv', "First name,Last name,CIN\nSouhail,Achgar,TA169892\n");
        $preview = $this->post("/api/groups/{$myGroup->id}/student-imports/preview", ['file' => $file], ['Accept' => 'application/json']);

        $preview->assertForbidden();
    }

    public function test_admin_can_attach_existing_student_to_a_shared_group_without_duplication(): void
    {
        $admin = $this->admin();
        $firstGroup = Group::create(['name' => 'DEV-101', 'level' => '1ère année']);
        $secondGroup = Group::create(['name' => 'DEV-201', 'level' => '2ème année']);
        $student = $this->student($firstGroup, 'TA169892');
        Sanctum::actingAs($admin);

        $file = UploadedFile::fake()->createWithContent('roster.csv', "First name,Last name,CIN\nSouhail,Achgar,TA169892\n");
        $preview = $this->post("/api/groups/{$secondGroup->id}/student-imports/preview", ['file' => $file], ['Accept' => 'application/json']);
        $batchId = $preview->assertOk()->json('data.batch_id');
        $this->postJson("/api/student-imports/{$batchId}/commit", ['rows' => [['index' => 0, 'action' => 'import']]])->assertOk()->assertJsonPath('data.created', 0)->assertJsonPath('data.updated', 1);

        $this->assertSame(1, Student::where('cne', 'TA169892')->count());
        $this->assertDatabaseHas('group_students', ['student_id' => $student->id, 'group_id' => $firstGroup->id]);
        $this->assertDatabaseHas('group_students', ['student_id' => $student->id, 'group_id' => $secondGroup->id]);
    }

    public function test_admin_can_delete_multiple_students_in_one_request(): void
    {
        $admin = $this->admin();
        $group = Group::create(['name' => 'DEV-BULK', 'level' => '2ème année']);
        $first = $this->student($group, 'TA180001');
        $second = $this->student($group, 'TA180002');
        Sanctum::actingAs($admin);

        $this->deleteJson('/api/students-bulk', ['student_ids' => [$first->id, $second->id]])
            ->assertOk()
            ->assertJsonPath('data.deleted', 2);

        $this->assertDatabaseMissing('students', ['id' => $first->id]);
        $this->assertDatabaseMissing('students', ['id' => $second->id]);
        $this->assertDatabaseMissing('users', ['id' => $first->user_id]);
        $this->assertDatabaseMissing('users', ['id' => $second->user_id]);
    }

    public function test_admin_can_archive_multiple_groups_in_one_request(): void
    {
        $admin = $this->admin();
        $first = Group::create(['name' => 'DEV-GROUP-1', 'level' => '2ème année']);
        $second = Group::create(['name' => 'DEV-GROUP-2', 'level' => '2ème année']);
        Sanctum::actingAs($admin);

        $this->deleteJson('/api/groups-bulk', ['group_ids' => [$first->id, $second->id], 'action' => 'archive'])
            ->assertOk()
            ->assertJsonPath('data.archived', 2);

        $this->assertDatabaseHas('groups', ['id' => $first->id, 'status' => 'archived']);
        $this->assertDatabaseHas('groups', ['id' => $second->id, 'status' => 'archived']);
    }

    public function test_archiving_a_group_removes_teacher_access_until_reassigned(): void
    {
        $admin = $this->admin();
        $group = Group::create(['name' => 'DETACH-GROUP', 'level' => '2ème année']);
        $teacher = $this->teacher($group);
        Sanctum::actingAs($admin);

        $this->deleteJson('/api/groups/' . $group->id)->assertNoContent();

        $this->assertDatabaseMissing('teacher_groups', ['teacher_id' => $teacher->id, 'group_id' => $group->id]);
    }

    public function test_admin_can_permanently_delete_empty_archived_groups(): void
    {
        $admin = $this->admin();
        $first = Group::create(['name' => 'EMPTY-GROUP-1', 'level' => '2ème année', 'status' => 'archived']);
        $second = Group::create(['name' => 'EMPTY-GROUP-2', 'level' => '2ème année', 'status' => 'archived']);
        Sanctum::actingAs($admin);

        $this->deleteJson('/api/groups-bulk', ['group_ids' => [$first->id, $second->id], 'action' => 'delete'])
            ->assertOk()
            ->assertJsonPath('data.deleted', 2);

        $this->assertDatabaseMissing('groups', ['id' => $first->id]);
        $this->assertDatabaseMissing('groups', ['id' => $second->id]);
    }

    public function test_group_deletion_is_blocked_when_a_trainee_has_no_other_group(): void
    {
        $admin = $this->admin();
        $group = Group::create(['name' => 'PROTECTED-GROUP', 'level' => '2ème année', 'status' => 'archived']);
        $this->student($group, 'TA180003');
        Sanctum::actingAs($admin);

        $this->deleteJson('/api/groups-bulk', ['group_ids' => [$group->id], 'action' => 'delete'])
            ->assertStatus(422)
            ->assertJsonPath('message', "Group {$group->name} cannot be deleted because some trainees belong to no other group. Move them to another group first, or delete those trainees.");

        $this->assertDatabaseHas('groups', ['id' => $group->id]);
    }

    public function test_archived_group_can_be_deleted_and_only_detaches_its_trainees(): void
    {
        $admin = $this->admin();
        $keep = Group::create(['name' => 'KEEP-GROUP', 'level' => '2ème année']);
        $spare = Group::create(['name' => 'SPARE-GROUP', 'level' => '2ème année', 'status' => 'archived']);

        // The trainee belongs to both, so dropping SPARE leaves them in KEEP.
        $student = $this->student($keep, 'TA180011');
        $student->groups()->syncWithoutDetaching([$spare->id]);
        $student->update(['group_id' => $spare->id]);

        Sanctum::actingAs($admin);
        $this->deleteJson('/api/groups-bulk', ['group_ids' => [$spare->id], 'action' => 'delete'])
            ->assertOk()
            ->assertJsonPath('data.deleted', 1);

        $this->assertDatabaseMissing('groups', ['id' => $spare->id]);
        // The trainee survives and is re-homed on their remaining group.
        $this->assertDatabaseHas('students', ['id' => $student->id, 'group_id' => $keep->id]);
        $this->assertDatabaseHas('group_students', ['student_id' => $student->id, 'group_id' => $keep->id]);
    }

    public function test_group_deletion_never_destroys_attendance_history(): void
    {
        $admin = $this->admin();
        $keep = Group::create(['name' => 'HISTORY-KEEP', 'level' => '2ème année']);
        $group = Group::create(['name' => 'HISTORY-GROUP', 'level' => '2ème année', 'status' => 'archived']);

        $student = $this->student($keep, 'TA180012');
        $student->groups()->syncWithoutDetaching([$group->id]);

        $teacherUser = User::create(['first_name' => 'Form', 'last_name' => 'Ateur', 'email' => 'hist.trainer@ofppt.test', 'password' => 'password123', 'role' => 'teacher', 'is_active' => true]);
        $teacher = Teacher::create(['user_id' => $teacherUser->id]);
        $module = Module::create(['teacher_id' => $teacher->id, 'name' => 'Histoire']);

        Absence::create([
            'student_id' => $student->id, 'teacher_id' => $teacher->id, 'module_id' => $module->id,
            'group_id' => $group->id, 'date' => '2026-09-14', 'start_time' => '08:00', 'end_time' => '10:00',
            'hours' => 2, 'subject' => 'Histoire', 'attendance_status' => 'absent', 'status' => 'unjustified',
        ]);

        Sanctum::actingAs($admin);
        $this->deleteJson('/api/groups-bulk', ['group_ids' => [$group->id], 'action' => 'delete'])
            ->assertStatus(422)
            ->assertJsonPath('message', "Group {$group->name} still holds 1 attendance records and cannot be deleted. Archiving keeps the group out of the way without losing that history.");

        $this->assertDatabaseHas('groups', ['id' => $group->id]);
        $this->assertSame(1, Absence::where('group_id', $group->id)->count());
    }

    public function test_teacher_email_uses_firstname_lastname_and_stays_unique(): void
    {
        Mail::fake();
        Sanctum::actingAs($this->admin());

        $this->postJson('/api/teachers', ['first_name' => 'Youssef', 'last_name' => 'Benali'])
            ->assertOk()
            ->assertJsonPath('credentials.email', 'youssef.benali@ofppt.com');

        // Accents and spaces are stripped, not encoded.
        $this->postJson('/api/teachers', ['first_name' => 'Zinéb', 'last_name' => 'El Amrani'])
            ->assertOk()
            ->assertJsonPath('credentials.email', 'zineb.elamrani@ofppt.com');

        // A second teacher with the same name gets a numbered address.
        $this->postJson('/api/teachers', ['first_name' => 'Youssef', 'last_name' => 'Benali'])
            ->assertOk()
            ->assertJsonPath('credentials.email', 'youssef.benali2@ofppt.com');
    }

    public function test_admin_can_create_assign_and_unassign_teacher_groups_without_subject(): void
    {
        Mail::fake();
        $admin = $this->admin();
        $group = Group::create(['name' => 'ASSIGN-GROUP', 'level' => 'Technicien']);
        Sanctum::actingAs($admin);

        $teacherResponse = $this->postJson('/api/teachers', [
            'first_name' => 'Assigned',
            'last_name' => 'Teacher',
            'group_ids' => [$group->id],
        ])->assertOk()->assertJsonPath('data.group_ids.0', $group->id)->assertJsonPath('data.subject', 'No subjects created');

        $teacherId = $teacherResponse->json('data.id');
        $teacherUserId = $teacherResponse->json('data.user_id');
        $teacherUser = User::findOrFail($teacherUserId);
        Sanctum::actingAs($teacherUser);

        $this->getJson('/api/dashboard/teacher')->assertOk()->assertJsonPath('data.my_groups', 1);
        $this->getJson('/api/groups')->assertOk()->assertJsonCount(1, 'data');

        Sanctum::actingAs($admin);
        $this->putJson('/api/teachers/' . $teacherId, ['group_ids' => []])->assertOk()->assertJsonPath('data.group_ids', []);
        Sanctum::actingAs($teacherUser);
        $this->getJson('/api/dashboard/teacher')->assertOk()->assertJsonPath('data.my_groups', 0);
        $this->getJson('/api/groups')->assertOk()->assertJsonCount(0, 'data');
    }

    public function test_teacher_subject_is_not_written_and_admin_sees_only_teacher_modules(): void
    {
        Mail::fake();
        $admin = $this->admin();
        Sanctum::actingAs($admin);

        $response = $this->postJson('/api/teachers', [
            'first_name' => 'Module',
            'last_name' => 'Teacher',
            'subject' => 'Legacy Subject',
        ])->assertOk();

        $teacher = Teacher::findOrFail($response->json('data.id'));
        $this->assertCount(0, $teacher->modules);
        Sanctum::actingAs($teacher->user);
        $this->postJson('/api/modules', ['name' => 'Database Systems'])->assertCreated();

        Sanctum::actingAs($admin);
        $teacherData = $this->getJson('/api/teachers')->assertOk()->json('data');
        $entry = collect($teacherData)->firstWhere('id', $teacher->id);
        $this->assertSame(['Database Systems'], $entry['subjects']);
    }

    public function test_teacher_can_manage_modules_and_must_use_their_module_for_attendance(): void
    {
        Mail::fake();
        $group = Group::create(['name' => 'DEV-301', 'level' => '2ème année']);
        $teacher = $this->teacher($group);
        $student = $this->student($group, 'TA170001');
        Sanctum::actingAs($teacher->user);

        $module = $this->postJson('/api/modules', ['name' => 'PHP / Laravel'])->assertCreated()->json('data');
        $this->postJson('/api/absences', [
            'attendance_records' => [['student_id' => $student->id, 'attendance_status' => 'present']],
            'group_id' => $group->id,
            'module_id' => $module['id'],
            'date' => now()->toDateString(),
            'start_time' => '08:30',
            'end_time' => '10:30',
        ])->assertCreated()->assertJsonPath('data.0.module_id', $module['id']);
        $this->assertDatabaseHas('absences', ['module_id' => $module['id'], 'subject' => 'PHP / Laravel']);
    }

    private function teacher(?Group $group = null): Teacher
    {
        $user = User::create(['first_name' => 'Teacher', 'last_name' => 'Test', 'email' => 'teacher' . random_int(1000, 9999) . '@ofppt.test', 'password' => 'password123', 'role' => 'teacher', 'is_active' => true]);
        $teacher = Teacher::create(['user_id' => $user->id]);
        if ($group) $teacher->groups()->attach($group->id);
        return $teacher->load('user');
    }

    private function admin(): User
    {
        return User::create(['first_name' => 'Admin', 'last_name' => 'Test', 'email' => 'admin' . random_int(1000, 9999) . '@ofppt.test', 'password' => 'password123', 'role' => 'admin', 'is_active' => true]);
    }

    private function student(Group $group, string $cne): Student
    {
        $user = User::create(['first_name' => 'Student', 'last_name' => 'Test', 'email' => strtolower($cne) . '@ofppt.test', 'password' => 'password123', 'role' => 'student', 'is_active' => true]);
        return Student::create(['user_id' => $user->id, 'cne' => $cne, 'group_id' => $group->id]);
    }
}