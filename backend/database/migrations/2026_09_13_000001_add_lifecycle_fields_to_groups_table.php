<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->string('academic_year', 20)->nullable()->after('level');
            $table->string('status', 20)->default('active')->after('academic_year');
            $table->index('status');
            $table->index('academic_year');
        });
    }

    public function down(): void
    {
        Schema::table('groups', function (Blueprint $table) {
            $table->dropIndex('groups_status_index');
            $table->dropIndex('groups_academic_year_index');
            $table->dropColumn(['academic_year', 'status']);
        });
    }
};