<?php

namespace App\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class TeacherResource extends JsonResource
{
    public function toArray($request): array
    {
        return [
            'id'              => $this->id,
            'user_id'         => $this->user_id,
            'first_name'      => $this->user->first_name,
            'last_name'       => $this->user->last_name,
            'email'           => $this->user->email,
            'phone'           => $this->user->phone,
            'subject'         => $this->modules->first()?->name ?? 'No subjects created',
            'subjects'        => $this->modules->pluck('name')->filter()->unique()->values()->toArray(),
            'groups_assigned' => $this->groups->where('status', 'active')->pluck('name')->values()->toArray(),
            'group_ids'       => $this->groups->where('status', 'active')->pluck('id')->values()->toArray(),
        ];
    }
}
