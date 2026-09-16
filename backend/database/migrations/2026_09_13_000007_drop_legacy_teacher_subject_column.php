<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('teachers', 'subject')) {
            return; // Fresh installs no longer have the legacy subject column.
        }

        Schema::table('teachers', function (Blueprint $table) {
            $table->dropColumn('subject');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('teachers', 'subject')) {
            return;
        }

        Schema::table('teachers', function (Blueprint $table) {
            $table->string('subject', 100)->nullable()->after('user_id');
        });
    }
};