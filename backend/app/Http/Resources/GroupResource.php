<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class GroupResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'            => $this->id,
            'name'          => $this->name,
            'level'         => $this->level,
            'degree'        => $this->degree ?? $this->level,
            'study_year'    => $this->study_year,
            'academic_year' => $this->academic_year,
            'status'        => $this->status,
            'student_count' => $this->students_count ?? $this->students()->count(),
            'teacher_count' => $this->teachers_count ?? $this->teachers()->count(),
            'absence_count' => $this->when(isset($this->absence_count), fn () => (int) $this->absence_count),
            'absence_hours' => $this->when(array_key_exists('absence_hours', $this->getAttributes()), fn () => (float) ($this->absence_hours ?? 0)),
            'last_session_date' => $this->when(array_key_exists('last_session_date', $this->getAttributes()), fn () => $this->last_session_date ? substr((string) $this->last_session_date, 0, 10) : null),
        ];
    }
}
