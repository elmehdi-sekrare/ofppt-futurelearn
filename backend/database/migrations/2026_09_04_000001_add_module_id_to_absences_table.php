<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('absences', function (Blueprint $table) {
            $table->foreignId('module_id')->nullable()->after('teacher_id')->constrained('modules')->nullOnDelete();
            $table->index('module_id');
        });
    }

    public function down(): void
    {
        Schema::table('absences', function (Blueprint $table) {
            $table->dropForeign(['module_id']);
            $table->dropIndex(['module_id']);
            $table->dropColumn('module_id');
        });
    }
};
