<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->string('degree', 80)->nullable()->after('level');
            $table->string('study_year', 30)->nullable()->after('degree');
            $table->index(['degree', 'study_year']);
        });
    }

    public function down(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->dropIndex('groups_degree_study_year_index');
            $table->dropColumn(['degree', 'study_year']);
        });
    }
};