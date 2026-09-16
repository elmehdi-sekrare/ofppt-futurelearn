<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('absences', function (Blueprint $table) {
            $table->enum('status', ['pending', 'justified', 'unjustified', 'voided'])->default('pending')->change();
        });
    }

    public function down(): void
    {
        Schema::table('absences', function (Blueprint $table) {
            $table->enum('status', ['pending', 'justified', 'unjustified'])->default('pending')->change();
        });
    }
};