<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Absence extends Model
{
    protected $fillable = [
        'student_id', 'teacher_id', 'module_id', 'group_id',
        'date', 'start_time', 'end_time', 'hours',
        'subject', 'notes', 'status', 'attendance_status', 'late_minutes',
         'resolution_source', 'resolution_note', 'resolved_by', 'resolved_at',
    ];

    protected static function booted(): void
    {
        static::creating(function (Absence $absence) {
            if ($absence->attendance_status === 'absent' && $absence->hours === null && $absence->start_time && $absence->end_time) {
                $start = strtotime($absence->start_time);
                $end = strtotime($absence->end_time);
                $absence->hours = round(($end - $start) / 3600, 2);
            }

            if ($absence->attendance_status !== 'absent') {
                $absence->hours = 0;
            }
        });
    }

    protected function casts(): array
    {
        return ['resolved_at' => 'datetime'];
    }

    public function student()
    {
        return $this->belongsTo(Student::class);
    }

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function module()
    {
        return $this->belongsTo(Module::class);
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function justification()
    {
        return $this->hasOne(Justification::class);
    }
}
