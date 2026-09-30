<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class StudentResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'                   => $this->id,
            'user_id'              => $this->user_id,
            'first_name'           => $this->user->first_name,
            'last_name'            => $this->user->last_name,
            'email'                => $this->user->email,
            'cne'                  => $this->cne,
            'phone'                => $this->phone ?? '',
            'group_id'             => $this->group_id,
            // A student can sit in several groups (the group_students pivot is
            // the source of truth). group_name keeps the primary one for
            // display; group_names carries all of them so filtering by any
            // group finds the student.
            'group_name'           => $this->primaryGroupName(),
            'group_names'          => $this->allGroupNames(),
            'total_absence_hours'  => $this->absenceHours(),
            'late_count'           => $this->lateCount(),
        ];
    }

    private function primaryGroupName(): string
    {
        $names = $this->allGroupNames();
        $current = optional($this->group)->name;

        // Prefer the legacy column when it still matches a real membership,
        // otherwise fall back to the first pivot group.
        if ($current && in_array($current, $names, true)) {
            return $current;
        }

        return $names[0] ?? ($current ?? '');
    }

    /** @return string[] */
    private function allGroupNames(): array
    {
        if (!$this->resource->relationLoaded('groups')) {
            return array_values(array_filter([optional($this->group)->name]));
        }

        return $this->groups->pluck('name')->filter()->unique()->values()->all();
    }

    /**
     * Prefer the withAttendanceTotals() aggregate. A student with no absences
     * gets SQL NULL for the sum, so we check for the attribute's presence
     * rather than its value — otherwise every such row costs an extra query.
     */
    private function absenceHours(): float
    {
        $attributes = $this->resource->getAttributes();

        if (array_key_exists('absent_hours', $attributes)) {
            return (float) ($attributes['absent_hours'] ?? 0);
        }

        return (float) $this->absences()
            ->where('attendance_status', 'absent')
            ->where('status', '!=', 'voided')
            ->sum('hours');
    }

    private function lateCount(): int
    {
        $attributes = $this->resource->getAttributes();

        if (array_key_exists('late_records', $attributes)) {
            return (int) ($attributes['late_records'] ?? 0);
        }

        return (int) $this->absences()
            ->where('attendance_status', 'late')
            ->where('status', '!=', 'voided')
            ->count();
    }
}
