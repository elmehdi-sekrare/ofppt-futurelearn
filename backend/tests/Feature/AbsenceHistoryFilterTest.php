<?php

namespace Tests\Feature;

use App\Models\Absence;
use App\Models\Group;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AbsenceHistoryFilterTest extends TestCase
{
    use RefreshDatabase;

    public function test_teacher_can_view_full_student_history_for_accessible_student(): void
    {
        $group = Group::create([
            'name' => 'DEV201-A',
            'code' => 'DEV201-A',
            'level' => '2eme annee',
        ]);

        $student = $this->createStudent($group, 'student-a@ofppt.com');
        $requestTeacher = $this->createTeacher($group, 'teacher-a@ofppt.com', 'Nadia', 'Karim');
        $otherTeacher = $this->createTeacher($group, 'teacher-b@ofppt.com', 'Omar', 'Fassi');

        Absence::create([
            'student_id' => $student->id,
            'teacher_id' => $requestTeacher->id,
            'group_id' => $group->id,
            'date' => '2026-03-10',
            'start_time' => '08:30',
            'end_time' => '10:30',
            'subject' => 'Algorithms',
            'status' => 'pending',
        ]);

        Absence::create([
            'student_id' => $student->id,
            'teacher_id' => $otherTeacher->id,
            'group_id' => $group->id,
            'date' => '2026-03-11',
            'start_time' => '10:30',
            'end_time' => '12:30',
            'subject' => 'Databases',
            'status' => 'justified',
        ]);

        Sanctum::actingAs($requestTeacher->user);

        $response = $this->get('/api/absences/student-history/' . $student->id, [
            'Accept' => 'application/json',
        ]);

        $response->assertOk()->assertJsonCount(2, 'data');
        $response->assertJsonFragment([
            'teacher_name' => $requestTeacher->user->first_name . ' ' . $requestTeacher->user->last_name,
        ]);
        $response->assertJsonFragment([
            'teacher_name' => $otherTeacher->user->first_name . ' ' . $otherTeacher->user->last_name,
        ]);
    }

    public function test_teacher_cannot_view_student_history_outside_assigned_groups(): void
    {
        $allowedGroup = Group::create([
            'name' => 'DEV201-B',
            'code' => 'DEV201-B',
            'level' => '2eme annee',
        ]);
        $otherGroup = Group::create([
            'name' => 'DEVOFWS-A',
            'code' => 'DEVOFWS-A',
            'level' => '1ere annee',
        ]);

        $requestTeacher = $this->createTeacher($allowedGroup, 'teacher-c@ofppt.com', 'Salma', 'Amrani');
        $outsideStudent = $this->createStudent($otherGroup, 'student-b@ofppt.com');

        Sanctum::actingAs($requestTeacher->user);

        $response = $this->get('/api/absences/student-history/' . $outsideStudent->id, [
            'Accept' => 'application/json',
        ]);

        $response
            ->assertForbidden()
            ->assertJson([
                'message' => 'Forbidden',
            ]);
    }

    private function createTeacher(Group $group, string $email, string $firstName, string $lastName): Teacher
    {
        $user = User::create([
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'password' => 'password123',
            'role' => 'teacher',
            'is_active' => true,
        ]);

        $teacher = Teacher::create([
            'user_id' => $user->id,
        ]);

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
}
