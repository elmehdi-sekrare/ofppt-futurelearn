<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Teacher extends Model
{
    protected $fillable = ['user_id'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function groups()
    {
        return $this->belongsToMany(Group::class, 'teacher_groups');
    }

    public function absences()
    {
        return $this->hasMany(Absence::class);
    }

    public function modules()
    {
        return $this->hasMany(Module::class);
    }
}
