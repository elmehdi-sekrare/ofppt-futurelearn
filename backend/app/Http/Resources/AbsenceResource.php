<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class AbsenceResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'           => $this->id,
            'student_id'   => $this->student_id,
            'module_id'    => $this->module_id,
            'student_name' => $this->student->user->first_name . ' ' . $this->student->user->last_name,
            'group_name'   => $this->group->name,
            'date'         => $this->date,
            'start_time'   => $this->start_time,
            'end_time'     => $this->end_time,
            'hours'        => (float) $this->hours,
            'subject'      => $this->subject,
            'teacher_name' => $this->teacher->user->first_name . ' ' . $this->teacher->user->last_name,
            'notes'        => $this->notes ?? '',
            'status'       => $this->status,
            'attendance_status' => $this->attendance_status,
            'late_minutes' => (int) $this->late_minutes,
            'resolution_source' => $this->resolution_source,
            'resolution_note' => $this->resolution_note,
            'resolved_at' => $this->resolved_at?->toISOString(),
        ];
    }
}
