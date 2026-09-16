<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\Student;
use App\Models\User;

class AttendanceRiskService
{
    public static function summaries(): array
    {
        return Student::with(['user', 'group', 'absences.justification'])->get()
            ->map(fn (Student $student) => self::summary($student))
            ->sortByDesc(fn (array $summary) => self::riskScore($summary['risk_level']))
            ->values()
            ->all();
    }

    public static function summary(Student $student): array
    {
        $records = $student->relationLoaded('absences') ? $student->absences : $student->absences()->with('justification')->get();
        $absences = $records->where('attendance_status', 'absent')->where('status', '!=', 'voided');
        $lateRecords = $records->where('attendance_status', 'late');
        $lastThirtyDays = now()->subDays(30)->toDateString();
        $recentAbsences = $absences->filter(fn ($record) => $record->date >= $lastThirtyDays);
        $recentLates = $lateRecords->filter(fn ($record) => $record->date >= $lastThirtyDays);
        $unexcusedHours = (float) $absences->where('status', '!=', 'justified')->sum('hours');
        $pendingJustifications = $absences->filter(fn ($record) => $record->justification?->status === 'pending')->count();
        $factors = [];

        if ($unexcusedHours >= 10) $factors[] = '10+ unexcused absence hours';
        if ($recentAbsences->count() >= 3) $factors[] = '3+ absences in the last 30 days';
        if ($recentLates->count() >= 3) $factors[] = '3+ late arrivals in the last 30 days';
        if ($pendingJustifications > 0) $factors[] = $pendingJustifications . ' pending justification' . ($pendingJustifications > 1 ? 's' : '');

        $riskLevel = $unexcusedHours >= 10 || $recentAbsences->count() >= 3
            ? 'high'
            : ($recentLates->count() >= 3 || $unexcusedHours >= 6 || $pendingJustifications > 0 ? 'medium' : (count($factors) ? 'low' : 'none'));

        return [
            'student_id' => $student->id,
            'student_name' => $student->user->first_name . ' ' . $student->user->last_name,
            'group_name' => $student->group->name,
            'risk_level' => $riskLevel,
            'absence_hours' => (float) $absences->sum('hours'),
            'unexcused_hours' => $unexcusedHours,
            'absence_count' => $absences->count(),
            'late_count' => $lateRecords->count(),
            'recent_absence_count' => $recentAbsences->count(),
            'recent_late_count' => $recentLates->count(),
            'pending_justifications' => $pendingJustifications,
            'factors' => $factors,
        ];
    }

    public static function notifyAdminsIfTriggered(Student $student, ?User $actor = null): void
    {
        $summary = self::summary($student);
        $triggers = array_filter($summary['factors'], fn (string $factor) => str_starts_with($factor, '10+') || str_starts_with($factor, '3+'));
        foreach ($triggers as $trigger) {
            $message = $summary['student_name'] . ' (' . $student->cne . '): ' . $trigger . '.';
            $alreadyNotified = Notification::where('title', 'Attendance risk alert')->where('message', $message)->exists();
            if ($alreadyNotified) continue;

            foreach (User::where('role', 'admin')->get() as $admin) {
                Notification::create([
                    'user_id' => $admin->id,
                    'title' => 'Attendance risk alert',
                    'message' => $message,
                    'type' => 'warning',
                ]);
            }
            AuditLogger::record($actor, 'attendance.risk_alert', 'Risk alert raised for ' . $summary['student_name'] . ': ' . $trigger, $student, $summary);
        }
    }

    private static function riskScore(string $riskLevel): int
    {
        return match ($riskLevel) {
            'high' => 4,
            'medium' => 3,
            'low' => 2,
            default => 1,
        };
    }
}
