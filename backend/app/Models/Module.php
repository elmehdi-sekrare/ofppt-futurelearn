<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Module extends Model
{
    protected $fillable = ['teacher_id', 'name'];

    public function teacher()
    {
        return $this->belongsTo(Teacher::class);
    }

    public function absences()
    {
        return $this->hasMany(Absence::class);
    }
}
