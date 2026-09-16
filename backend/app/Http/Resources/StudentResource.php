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
            'total_absence_hours'  => (float) $this->absences()->where('attendance_status', 'absent')->where('status', '!=', 'voided')->sum('hours'),
            'late_count'           => (int) $this->absences()->where('attendance_status', 'late')->where('status', '!=', 'voided')->count(),
        ];
    }
}