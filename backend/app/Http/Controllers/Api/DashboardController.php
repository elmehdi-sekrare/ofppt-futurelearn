<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Student;
use App\Models\Teacher;
use App\Models\Absence;
use App\Models\Justification;
use App\Services\AttendanceRiskService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class DashboardController extends Controller
{
    /** GET /api/dashboard/admin */
    public function admin()
    {
        $totalStudents = Student::count();
        $totalTeachers = Teacher::count();
        $totalAbsenceHours = Absence::where('attendance_status', 'absent')->where('status', '!=', 'voided')->sum('hours');
        $totalPossibleHours = $totalStudents * 40; // approximate
        $absenceRate = $totalPossibleHours > 0
            ? round(($totalAbsenceHours / $totalPossibleHours) * 100, 1)
            : 0;

        $riskSummaries = AttendanceRiskService::summaries();

        return response()->json([
            'data' => [
                'total_students'  => $totalStudents,
                'total_teachers'  => $totalTeachers,
                'absence_rate'    => $absenceRate,
                'pending_reviews' => Justification::where('status', 'pending')->count(),
                'high_risk_students' => collect($riskSummaries)->where('risk_level', 'high')->count(),
                'late_count'      => Absence::where('attendance_status', 'late')->where('status', '!=', 'voided')->count(),
            ],
        ]);
    }

    /** GET /api/dashboard/teacher */
    public function teacher(Request $request)
    {
        $teacher = $request->user()->teacher;

        return response()->json([
            'data' => [
                'my_groups'       => $teacher->groups()->where('groups.status', 'active')->count(),
                'my_students'     => Student::whereHas('groups', fn ($query) => $query->whereIn('groups.id', $teacher->groups()->where('groups.status', 'active')->pluck('groups.id')))->count(),
                'today_absences'  => Absence::where('teacher_id', $teacher->id)
                                        ->where('attendance_status', 'absent')
                                        ->where('status', '!=', 'voided')
                                        ->whereDate('date', today())->count(),
                'today_late'      => Absence::where('teacher_id', $teacher->id)
                                        ->where('attendance_status', 'late')
                                        ->where('status', '!=', 'voided')
                                        ->whereDate('date', today())->count(),
            ],
        ]);
    }

    /** GET /api/dashboard/student */
    public function student(Request $request)
    {
        $student = $request->user()->student;
        $absences = $student->absences->where('attendance_status', 'absent')->where('status', '!=', 'voided');

        $totalHours = $absences->sum('hours');
        $justifiedHours = $absences->where('status', 'justified')->sum('hours');
        $unjustifiedHours = $absences->where('status', 'unjustified')->sum('hours');
        $pendingHours = $absences->where('status', 'pending')->sum('hours');

        // Approximate attendance rate (assuming 600 total hours per year)
        $totalPossible = 600;
        $attendanceRate = $totalPossible > 0
            ? round((1 - $totalHours / $totalPossible) * 100, 1)
            : 100;

        return response()->json([
            'data' => [
                'absence_hours'         => (float) $totalHours,
                'justified_hours'       => (float) $justifiedHours,
                'unjustified_hours'     => (float) $unjustifiedHours,
                'pending_hours'         => (float) $pendingHours,
                'pending_justifications'=> Justification::whereIn('absence_id', $absences->pluck('id'))
                                              ->where('status', 'pending')->count(),
                'unjustified_count'     => $absences->where('status', 'unjustified')->count(),
                'attendance_rate'       => $attendanceRate,
            ],
        ]);
    }

    /** GET /api/dashboard/chart — monthly attendance/absence data */
    public function chart()
    {
        $driver = DB::getDriverName();
        $today = Carbon::today();
        $start = $today->copy()->subDays(29); // last 30 days
        $totalStudents = max(Student::count(), 1);

        if ($driver === 'pgsql') {
            $rows = Absence::select(
                    DB::raw('date::text as date_str'),
                    DB::raw('COALESCE(SUM(hours), 0) as total_hours'),
                    DB::raw('COUNT(*) as absence_count')
                )
                ->where('attendance_status', 'absent')->where('status', '!=', 'voided')
                ->where('date', '>=', $start->toDateString())
                ->where('date', '<=', $today->toDateString())
                ->groupBy('date')
                ->get()
                ->keyBy('date_str');
        } else {
            $rows = Absence::select(
                    DB::raw('DATE(date) as date_str'),
                    DB::raw('COALESCE(SUM(hours), 0) as total_hours'),
                    DB::raw('COUNT(*) as absence_count')
                )
                ->where('attendance_status', 'absent')->where('status', '!=', 'voided')
                ->where('date', '>=', $start->toDateString())
                ->where('date', '<=', $today->toDateString())
                ->groupBy(DB::raw('DATE(date)'))
                ->get()
                ->keyBy('date_str');
        }

        $data = [];
        for ($i = 0; $i < 30; $i++) {
            $dt = $start->copy()->addDays($i);
            $key = $dt->toDateString();
            $row = $rows->get($key);
            $absenceHours = $row ? (float) $row->total_hours : 0;
            $absenceCount = $row ? (int) $row->absence_count : 0;
            $data[] = [
                'day'        => $dt->format('D'),
                'date'       => $dt->format('Y-m-d'),
                'attendance' => round(max(0, ($totalStudents * 8) - $absenceHours), 1), // 8h per day
                'absences'   => round($absenceHours, 1),
                'count'      => $absenceCount,
            ];
        }
        return response()->json(['data' => $data]);
    }

    /** GET /api/dashboard/heatmap — weekly absence heatmap (4 weeks × 5 days) */
    /**
     * GET /api/dashboard/heatmap
     *
     * Six weeks of absence hours per weekday. The window ends on the most
     * recent week that actually has data rather than always on today, so a
     * school that records attendance in bursts still sees a populated grid
     * instead of an empty one.
     */
    public function heatmap()
    {
        $driver = DB::getDriverName();
        $dateExpr = $driver === 'pgsql' ? 'date::text' : 'DATE(date)';

        $latest = Absence::where('attendance_status', 'absent')
            ->where('status', '!=', 'voided')
            ->max('date');

        $anchor = $latest ? Carbon::parse($latest) : Carbon::today();
        // Never look into the future, but do follow the data backwards.
        if ($anchor->greaterThan(Carbon::today())) $anchor = Carbon::today();

        $weeks = 6;
        $lastWeekStart = $anchor->copy()->startOfWeek(Carbon::MONDAY);
        $start = $lastWeekStart->copy()->subWeeks($weeks - 1);
        $end = $lastWeekStart->copy()->addDays(6);

        $rows = Absence::select(
                DB::raw($dateExpr . ' as date_str'),
                DB::raw('COALESCE(SUM(hours), 0) as total_hours'),
                DB::raw('COUNT(*) as absence_count')
            )
            ->where('attendance_status', 'absent')
            ->where('status', '!=', 'voided')
            ->whereBetween('date', [$start->toDateString(), $end->toDateString()])
            ->groupBy(DB::raw($dateExpr))
            ->get()
            ->keyBy('date_str');

        $grid = [];
        $peak = 0.0;
        for ($w = 0; $w < $weeks; $w++) {
            $weekStart = $start->copy()->addWeeks($w);
            $days = [];
            // Full week: sessions are sometimes recorded at the weekend, and a
            // 5- or 6-day grid silently hides those days.
            for ($d = 0; $d < 7; $d++) {
                $dt = $weekStart->copy()->addDays($d);
                $row = $rows->get($dt->toDateString());
                $hours = $row ? round((float) $row->total_hours, 1) : 0.0;
                $peak = max($peak, $hours);
                $days[] = [
                    'date' => $dt->toDateString(),
                    'hours' => $hours,
                    'count' => $row ? (int) $row->absence_count : 0,
                    'future' => $dt->greaterThan(Carbon::today()),
                ];
            }
            $grid[] = [
                'week' => 'S' . $weekStart->weekOfYear,
                'week_start' => $weekStart->toDateString(),
                'days' => $days,
            ];
        }

        return response()->json(['data' => [
            'weeks' => $grid,
            'peak_hours' => $peak,
            'range_start' => $start->toDateString(),
            'range_end' => $end->toDateString(),
            'anchored_on_data' => (bool) $latest,
        ]]);
    }

    /**
     * GET /api/dashboard/insights
     *
     * Powers the risk forecast and the pattern detector.
     *
     * Risk is scored relative to the cohort rather than against a fixed
     * 60-hour limit, so the administration sees who needs attention from the
     * very first recorded session instead of waiting for someone to approach
     * exclusion. Three signals, each 0..1, combined into a 0..100 score:
     *   - absence rate : share of that student's sessions missed
     *   - severity     : unjustified hours against the cohort's worst
     *   - recency      : how much of it happened in the last 30 days
     */
    public function insights()
    {
        if (request()->user()->role !== 'admin') {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $records = Absence::with(['student.user', 'student.group'])
            ->where('status', '!=', 'voided')
            ->get();

        if ($records->isEmpty()) {
            return response()->json(['data' => [
                'has_data' => false,
                'students' => [],
                'patterns' => [],
                'weekday_totals' => array_fill(0, 7, 0),
                'cohort' => ['absence_rate' => 0, 'sessions' => 0, 'absent_hours' => 0],
            ]]);
        }

        $recentFrom = now()->subDays(30)->toDateString();
        $byStudent = $records->groupBy('student_id');

        $worstUnjustified = 0.0;
        $rows = [];

        foreach ($byStudent as $studentRecords) {
            $student = $studentRecords->first()->student;
            if (!$student || !$student->user) continue;

            $absent = $studentRecords->where('attendance_status', 'absent');
            $unjustifiedHours = (float) $absent->where('status', '!=', 'justified')->sum('hours');
            $worstUnjustified = max($worstUnjustified, $unjustifiedHours);

            $rows[] = [
                'student' => $student,
                'sessions' => $studentRecords->count(),
                'absent' => $absent,
                'late' => $studentRecords->where('attendance_status', 'late'),
                'absent_hours' => (float) $absent->sum('hours'),
                'unjustified_hours' => $unjustifiedHours,
                'recent_hours' => (float) $absent->filter(fn ($r) => (string) $r->date >= $recentFrom)->sum('hours'),
            ];
        }

        $students = collect($rows)->map(function (array $row) use ($worstUnjustified) {
            $sessions = max(1, $row['sessions']);
            $absenceRate = $row['absent']->count() / $sessions;
            $severity = $worstUnjustified > 0 ? $row['unjustified_hours'] / $worstUnjustified : 0.0;
            $recency = $row['absent_hours'] > 0 ? $row['recent_hours'] / $row['absent_hours'] : 0.0;

            $score = (int) round(100 * min(1.0, ($absenceRate * 0.45) + ($severity * 0.40) + ($recency * 0.15)));

            $reasons = [];
            if ($absenceRate > 0) $reasons[] = ['key' => 'rate', 'value' => (int) round($absenceRate * 100)];
            if ($row['unjustified_hours'] > 0) $reasons[] = ['key' => 'unjustified', 'value' => $row['unjustified_hours']];
            if ($row['late']->count() > 0) $reasons[] = ['key' => 'late', 'value' => $row['late']->count()];

            return [
                'student_id' => $row['student']->id,
                'student_name' => $row['student']->user->first_name . ' ' . $row['student']->user->last_name,
                'group_name' => optional($row['student']->group)->name ?? '',
                'score' => $score,
                'level' => $score >= 70 ? 'critical' : ($score >= 45 ? 'high' : ($score >= 20 ? 'watch' : 'ok')),
                'absent_hours' => $row['absent_hours'],
                'unjustified_hours' => $row['unjustified_hours'],
                'absence_count' => $row['absent']->count(),
                'late_count' => $row['late']->count(),
                'sessions' => $row['sessions'],
                'absence_rate' => (int) round($absenceRate * 100),
                'reasons' => $reasons,
            ];
        })
        ->filter(fn (array $s) => $s['score'] > 0)
        ->sortByDesc('score')
        ->take(6)
        ->values();

        // Weekday distribution (Monday = 0) and per-student concentration.
        $weekdayTotals = array_fill(0, 7, 0);
        foreach ($records->where('attendance_status', 'absent') as $record) {
            $weekdayTotals[(int) Carbon::parse($record->date)->dayOfWeekIso - 1]++;
        }

        $patterns = [];
        foreach ($byStudent as $studentRecords) {
            $student = $studentRecords->first()->student;
            if (!$student || !$student->user) continue;

            $absent = $studentRecords->where('attendance_status', 'absent');
            // Two repeats is enough to surface a habit. Three was too strict
            // for a school that has only just started recording sessions.
            if ($absent->count() < 2) continue;

            $perDay = [];
            foreach ($absent as $record) {
                $index = (int) Carbon::parse($record->date)->dayOfWeekIso - 1;
                $perDay[$index] = ($perDay[$index] ?? 0) + 1;
            }
            arsort($perDay);
            $dayIndex = array_key_first($perDay);
            $count = $perDay[$dayIndex];
            $share = (int) round(($count / $absent->count()) * 100);

            if ($share < 50) continue;

            $patterns[] = [
                'student_id' => $student->id,
                'student_name' => $student->user->first_name . ' ' . $student->user->last_name,
                'group_name' => optional($student->group)->name ?? '',
                'day_index' => $dayIndex,
                'count' => $count,
                'total' => $absent->count(),
                'share' => $share,
                'severity' => $share >= 80 && $count >= 3 ? 'critical' : ($share >= 60 ? 'warning' : 'info'),
            ];
        }

        usort($patterns, fn ($a, $b) => [$b['share'], $b['count']] <=> [$a['share'], $a['count']]);

        $totalSessions = $records->count();
        $totalAbsent = $records->where('attendance_status', 'absent')->count();

        return response()->json(['data' => [
            'has_data' => true,
            'students' => $students,
            'patterns' => array_slice($patterns, 0, 8),
            'weekday_totals' => $weekdayTotals,
            'cohort' => [
                'sessions' => $totalSessions,
                'absent_hours' => (float) $records->where('attendance_status', 'absent')->sum('hours'),
                'absence_rate' => $totalSessions > 0 ? round(($totalAbsent / $totalSessions) * 100, 1) : 0,
            ],
        ]]);
    }

    /** GET /api/dashboard/risk */
    public function risk(Request $request)
    {
        if ($request->user()->role !== 'admin') return response()->json(['message' => 'Forbidden'], 403);
        return response()->json(['data' => AttendanceRiskService::summaries()]);
    }
}
