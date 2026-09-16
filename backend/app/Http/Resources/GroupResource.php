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
        ];
    }
}
