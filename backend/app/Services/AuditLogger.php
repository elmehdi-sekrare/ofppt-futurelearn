<?php

namespace App\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;

class AuditLogger
{
    public static function record(?User $actor, string $event, string $description, ?Model $subject = null, array $metadata = []): void
    {
        AuditLog::create([
            'actor_user_id' => $actor?->id,
            'event' => $event,
            'subject_type' => $subject ? $subject::class : null,
            'subject_id' => $subject?->getKey(),
            'description' => $description,
            'metadata' => $metadata ?: null,
        ]);
    }
}
