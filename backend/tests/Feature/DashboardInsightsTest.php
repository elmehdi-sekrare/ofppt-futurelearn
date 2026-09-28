<?php

namespace Tests\Feature;

use App\Models\Absence;
use App\Models\Group;
use App\Models\Module;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class DashboardInsightsTest extends TestCase
{
    use RefreshDatabase;

    public function test_insights_rank_students_without_waiting_for_an_exclusion_threshold(): void
    {
        $group = $this->group();
        $teacher = $this->teacher($group);
        $module = Module::create(['teacher_id' => $teacher->id, 'name' => 'Maths']);

        $heavy = $this->student($group, 'heavy@ofppt.test');
        $light = $this->student($group, 'light@ofppt.test');

        // Two unjustified absences of 2h each, well under any 60-hour limit.
        foreach (['2026-09-07', '2026-09-14'] as $date) {
            $this->record($heavy, $teacher, $module, $group, $date, 'absent', 'unjustified', 2);
        }
        $this->record($heavy, $teacher, $module, $group, '2026-09-21', 'present', 'pending', 0);
        $this->record($light, $teacher, $module, $group, '2026-09-07', 'present', 'pending', 0);

        Sanctum::actingAs($this->admin());
        $data = $this->getJson('/api/dashboard/insights')->assertOk()->json('data');

        $this->assertTrue($data['has_data']);
        $this->assertNotEmpty($data['students'], 'A student with only 4 unjustified hours must still be ranked.');

        $top = $data['students'][0];
        $this->assertSame($heavy->id, $top['student_id']);
        $this->assertGreaterThan(0, $top['score']);
        $this->assertSame(67, $top['absence_rate']); // 2 of 3 sessions
        $this->assertSame(4.0, (float) $top['unjustified_hours']);
    }

    public function test_insights_detect_a_repeated_weekday_pattern(): void
    {
        $group = $this->group();
        $teacher = $this->teacher($group);
        $module = Module::create(['teacher_id' => $teacher->id, 'name' => 'Physique']);
        $student = $this->student($group, 'monday@ofppt.test');

        // Three Mondays in a row.
        foreach (['2026-09-07', '2026-09-14', '2026-09-21'] as $date) {
            $this->record($student, $teacher, $module, $group, $date, 'absent', 'unjustified', 2);
        }

        Sanctum::actingAs($this->admin());
        $data = $this->getJson('/api/dashboard/insights')->assertOk()->json('data');

        $this->assertCount(1, $data['patterns']);
        $this->assertSame(0, $data['patterns'][0]['day_index']); // Monday
        $this->assertSame(100, $data['patterns'][0]['share']);
        $this->assertSame('critical', $data['patterns'][0]['severity']);
        $this->assertSame(3, $data['weekday_totals'][0]);
    }

    public function test_heatmap_follows_the_data_instead_of_always_ending_today(): void
    {
        $group = $this->group();
        $teacher = $this->teacher($group);
        $module = Module::create(['teacher_id' => $teacher->id, 'name' => 'Anglais']);
        $student = $this->student($group, 'old@ofppt.test');

        // A Sunday well in the past: the old fixed Mon–Fri / 4-week grid missed both.
        $this->record($student, $teacher, $module, $group, '2026-09-13', 'absent', 'unjustified', 3);

        Sanctum::actingAs($this->admin());
        $data = $this->getJson('/api/dashboard/heatmap')->assertOk()->json('data');

        $this->assertTrue($data['anchored_on_data']);
        $this->assertSame(3.0, (float) $data['peak_hours']);
        $this->assertSame('2026-09-13', $data['range_end']);

        $cells = collect($data['weeks'])->flatMap(fn ($week) => $week['days']);
        $this->assertSame(7, count($data['weeks'][0]['days']), 'The grid must cover the whole week.');
        $this->assertSame(3.0, (float) $cells->firstWhere('date', '2026-09-13')['hours']);
    }

    public function test_insights_are_admin_only(): void
    {
        $group = $this->group();
        Sanctum::actingAs($this->teacher($group)->user);
        $this->getJson('/api/dashboard/insights')->assertStatus(403);
    }

    // ── helpers ──────────────────────────────────────────────

    private function record(Student $student, Teacher $teacher, Module $module, Group $group, string $date, string $attendance, string $status, float $hours): void
    {
        Absence::create([
            'student_id' => $student->id,
            'teacher_id' => $teacher->id,
            'module_id' => $module->id,
            'group_id' => $group->id,
            'date' => $date,
            'start_time' => '08:00',
            'end_time' => '10:00',
            'hours' => $hours,
            'subject' => $module->name,
            'attendance_status' => $attendance,
            'status' => $status,
        ]);
    }

    private function group(): Group
    {
        return Group::create(['name' => 'DEV301-A', 'level' => '2eme annee']);
    }

    private function admin(): User
    {
        return User::create(['first_name' => 'Admin', 'last_name' => 'Test', 'email' => 'admin.insights@ofppt.test', 'password' => 'password123', 'role' => 'admin', 'is_active' => true]);
    }

    private function teacher(Group $group): Teacher
    {
        $user = User::create(['first_name' => 'Prof', 'last_name' => 'Test', 'email' => 'prof.insights@ofppt.test', 'password' => 'password123', 'role' => 'teacher', 'is_active' => true]);
        $teacher = Teacher::create(['user_id' => $user->id]);
        $teacher->groups()->sync([$group->id]);
        return $teacher;
    }

    private function student(Group $group, string $email): Student
    {
        $user = User::create(['first_name' => 'Stagiaire', 'last_name' => 'Test', 'email' => $email, 'password' => 'password123', 'role' => 'student', 'is_active' => true]);
        return Student::create(['user_id' => $user->id, 'cne' => 'CNE' . random_int(10000, 99999), 'group_id' => $group->id]);
    }
}
