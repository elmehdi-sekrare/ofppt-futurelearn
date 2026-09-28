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
            'group_name'           => optional($this->group)->name ?? optional($this->groups->first())->name ?? '',
            'total_absence_hours'  => $this->absenceHours(),
            'late_count'           => $this->lateCount(),
        ];
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
