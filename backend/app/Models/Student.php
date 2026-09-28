<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Student extends Model
{
    protected $fillable = ['user_id', 'cne', 'phone', 'group_id'];

    protected static function booted(): void
    {
        static::created(function (Student $student): void {
            if ($student->group_id) $student->groups()->syncWithoutDetaching([$student->group_id]);
        });
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function group()
    {
        return $this->belongsTo(Group::class);
    }

    public function groups()
    {
        return $this->belongsToMany(Group::class, 'group_students')->withPivot(['joined_at', 'left_at'])->withTimestamps();
    }

    public function absences()
    {
        return $this->hasMany(Absence::class);
    }

    /**
     * Preload the absence-hour sum and late count as aggregates so
     * StudentResource does not run two extra queries per student.
     */
    public function scopeWithAttendanceTotals($query)
    {
        return $query
            ->withSum(['absences as absent_hours' => fn ($q) => $q
                ->where('attendance_status', 'absent')
                ->where('status', '!=', 'voided')], 'hours')
            ->withCount(['absences as late_records' => fn ($q) => $q
                ->where('attendance_status', 'late')
                ->where('status', '!=', 'voided')]);
    }
}
