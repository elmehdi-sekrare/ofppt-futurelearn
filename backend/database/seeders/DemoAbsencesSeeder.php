<?php

namespace Database\Seeders;

use App\Models\Absence;
use App\Models\Student;
use App\Models\Teacher;
use Illuminate\Database\Seeder;
use Carbon\Carbon;

/**
 * Generates realistic demo absence data across the last 30 days so the
 * dashboard chart, heatmap, absence rate and pending reviews look alive.
 * Safe to re-run: it clears its own demo rows first (notes marked [demo]).
 */
class DemoAbsencesSeeder extends Seeder
{
    public function run(): void
    {
        // Remove previously seeded demo absences (and their justifications cascade)
        Absence::where('notes', 'like', '%[demo]%')->delete();

        $students = Student::with('group')->get();
        $teachers = Teacher::with('groups')->get();

        if ($students->isEmpty() || $teachers->isEmpty()) {
            return;
        }

        $subjects = ['Développement Web', 'Base de données', 'Réseaux', 'PHP / Laravel', 'Mathématiques'];
        $slots = [
            ['08:30', '10:30', 2],
            ['10:30', '12:30', 2],
            ['13:30', '15:30', 2],
            ['15:30', '17:30', 2],
        ];
        $statuses = ['justified', 'unjustified', 'pending', 'pending'];

        $today = Carbon::today();

        for ($i = 29; $i >= 0; $i--) {
            $date = $today->copy()->subDays($i);

            // Skip weekends
            if ($date->isWeekend()) {
                continue;
            }

            // A handful of absences per weekday, more recently for a rising trend
            $count = random_int(0, 5) + ($i < 10 ? 1 : 0);

            for ($n = 0; $n < $count; $n++) {
                $student = $students->random();
                $group = $student->group;
                if (!$group) {
                    continue;
                }

                // Pick a teacher assigned to this group, else any teacher
                $teacher = $teachers->first(fn ($t) => $t->groups->contains('id', $group->id)) ?? $teachers->random();
                $slot = $slots[array_rand($slots)];

                Absence::create([
                    'student_id' => $student->id,
                    'teacher_id' => $teacher->id,
                    'group_id'   => $group->id,
                    'date'       => $date->toDateString(),
                    'start_time' => $slot[0],
                    'end_time'   => $slot[1],
                    'hours'      => $slot[2],
                    'subject'    => $subjects[array_rand($subjects)],
                    'notes'      => '[demo] generated sample',
                    'status'     => $statuses[array_rand($statuses)],
                ]);
            }
        }

        // Concentrate absences on a few students so the AI Risk Predictor lights up.
        // Each "at-risk" student accrues 22-46 absent hours across recent weekdays.
        $atRisk = $students->shuffle()->take(4);
        $targetHours = [46, 38, 30, 24];

        foreach ($atRisk as $idx => $student) {
            $group = $student->group;
            if (!$group) {
                continue;
            }
            $teacher = $teachers->first(fn ($t) => $t->groups->contains('id', $group->id)) ?? $teachers->random();
            $remaining = $targetHours[$idx] ?? 24;

            for ($i = 20; $i >= 0 && $remaining > 0; $i--) {
                $date = $today->copy()->subDays($i);
                if ($date->isWeekend()) {
                    continue;
                }
                // ~60% chance this student is absent on a given recent weekday
                if (random_int(1, 10) > 6) {
                    continue;
                }
                $slot = $slots[array_rand($slots)];
                Absence::create([
                    'student_id' => $student->id,
                    'teacher_id' => $teacher->id,
                    'group_id'   => $group->id,
                    'date'       => $date->toDateString(),
                    'start_time' => $slot[0],
                    'end_time'   => $slot[1],
                    'hours'      => $slot[2],
                    'subject'    => $subjects[array_rand($subjects)],
                    'notes'      => '[demo] at-risk sample',
                    'status'     => $statuses[array_rand($statuses)],
                ]);
                $remaining -= $slot[2];
            }
        }

        // Create clear "same weekday" patterns so the Pattern Detector has data.
        // Each of these students is absent ~4-5 times, mostly on one fixed weekday.
        $remaining = $students->reject(fn ($s) => $atRisk->contains('id', $s->id))->shuffle()->take(3)->values();
        // Carbon dayOfWeek: 1=Mon, 2=Tue, 3=Wed
        $patternDays = [1, 2, 3];

        foreach ($remaining as $idx => $student) {
            $group = $student->group;
            if (!$group) {
                continue;
            }
            $teacher = $teachers->first(fn ($t) => $t->groups->contains('id', $group->id)) ?? $teachers->random();
            $targetDay = $patternDays[$idx] ?? 1;
            $placed = 0;

            // Walk back over the last ~8 weeks, placing an absence on the target weekday
            for ($i = 0; $i < 56 && $placed < 5; $i++) {
                $date = $today->copy()->subDays($i);
                if ($date->dayOfWeekIso !== $targetDay) {
                    continue;
                }
                $slot = $slots[array_rand($slots)];
                Absence::create([
                    'student_id' => $student->id,
                    'teacher_id' => $teacher->id,
                    'group_id'   => $group->id,
                    'date'       => $date->toDateString(),
                    'start_time' => $slot[0],
                    'end_time'   => $slot[1],
                    'hours'      => $slot[2],
                    'subject'    => $subjects[array_rand($subjects)],
                    'notes'      => '[demo] pattern sample',
                    'status'     => $statuses[array_rand($statuses)],
                ]);
                $placed++;
            }
        }
    }
}
