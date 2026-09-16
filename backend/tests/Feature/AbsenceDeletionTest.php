<?php

namespace Tests\Feature;

use App\Models\Absence;
use App\Models\Group;
use App\Models\Justification;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AbsenceDeletionTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_permanently_delete_an_absence_they_marked(): void
    {
        $group = $this->createGroup();
        $teacher = $this->createTeacher($group, 'teacher@ofppt.com');
        $student = $this->createStudent($group, 'student@ofppt.com');
        $absence = $this->createAbsence($student, $teacher, $group);

        $justification = Justification::create([
            'absence_id' => $absence->id,
            'reason' => 'Medical appointment',
            'file_name' => 'note.pdf',
            'file_path' => 'justifications/note.pdf',
            'file_type' => 'pdf',
        ]);

        Sanctum::actingAs($teacher->user);

        $this->deleteJson('/api/absences/' . $absence->id)
            ->assertNoContent();

        $this->assertDatabaseMissing('absences', ['id' => $absence->id]);
        $this->assertDatabaseMissing('justifications', ['id' => $justification->id]);
    }

    public function test_teacher_cannot_delete_an_absence_marked_by_another_teacher(): void
    {
        $group = $this->createGroup();
        $recordOwner = $this->createTeacher($group, 'owner@ofppt.com');
        $otherTeacher = $this->createTeacher($group, 'other@ofppt.com');
        $student = $this->createStudent($group, 'student@ofppt.com');
        $absence = $this->createAbsence($student, $recordOwner, $group);

        Sanctum::actingAs($otherTeacher->user);

        $this->deleteJson('/api/absences/' . $absence->id)
            ->assertForbidden()
            ->assertJson(['message' => 'Forbidden']);

        $this->assertDatabaseHas('absences', ['id' => $absence->id]);
    }

    private function createGroup(): Group
    {
        return Group::create([
            'name' => 'DEV201-A',
            'code' => 'DEV201-A',
            'level' => '2eme annee',
        ]);
    }

    private function createTeacher(Group $group, string $email): Teacher
    {
        $user = User::create([
            'first_name' => 'Teacher',
            'last_name' => 'Test',
            'email' => $email,
            'password' => 'password123',
            'role' => 'teacher',
            'is_active' => true,
        ]);

        $teacher = Teacher::create(['user_id' => $user->id, 'subject' => 'Web Dev']);
        $teacher->groups()->attach($group->id);

        return $teacher->load('user');
    }

    private function createStudent(Group $group, string $email): Student
    {
        $user = User::create([
            'first_name' => 'Student',
            'last_name' => 'Test',
            'email' => $email,
            'password' => 'password123',
            'role' => 'student',
            'is_active' => true,
        ]);

        return Student::create([
            'user_id' => $user->id,
            'cne' => 'CNE' . random_int(10000, 99999),
            'group_id' => $group->id,
        ]);
    }

    private function createAbsence(Student $student, Teacher $teacher, Group $group): Absence
    {
        return Absence::create([
            'student_id' => $student->id,
            'teacher_id' => $teacher->id,
            'group_id' => $group->id,
            'date' => '2026-07-21',
            'start_time' => '08:30',
            'end_time' => '10:30',
            'subject' => 'Web Dev',
            'status' => 'pending',
        ]);
    }
}
