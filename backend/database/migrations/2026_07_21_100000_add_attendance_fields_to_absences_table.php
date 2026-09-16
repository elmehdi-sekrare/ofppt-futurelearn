<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('absences', function (Blueprint $table) {
            $table->string('attendance_status', 20)->default('absent')->after('status');
            $table->unsignedSmallInteger('late_minutes')->default(0)->after('attendance_status');
            $table->index(['attendance_status', 'date']);
        });
    }

    public function down(): void
    {
        Schema::table('absences', function (Blueprint $table) {
            $table->dropIndex(['attendance_status', 'date']);
            $table->dropColumn(['attendance_status', 'late_minutes']);
        });
    }
};
