<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Group extends Model
{
    protected $fillable = ['name', 'code', 'level', 'degree', 'study_year', 'academic_year', 'status'];

    public function students()
    {
        return $this->belongsToMany(Student::class, 'group_students')->withPivot(['joined_at', 'left_at'])->withTimestamps();
    }

    public function teachers()
    {
        return $this->belongsToMany(Teacher::class, 'teacher_groups');
    }

    public function absences()
    {
        return $this->hasMany(Absence::class);
    }
}
