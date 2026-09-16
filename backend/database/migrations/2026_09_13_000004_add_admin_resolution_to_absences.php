<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('absences', function (Blueprint $table) {
            $table->string('resolution_source', 20)->nullable()->after('late_minutes');
            $table->text('resolution_note')->nullable()->after('resolution_source');
            $table->foreignId('resolved_by')->nullable()->after('resolution_note')->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable()->after('resolved_by');
            $table->index(['attendance_status', 'status']);
        });
    }

    public function down(): void
    {
        Schema::table('absences', function (Blueprint $table) {
            $table->dropForeign(['resolved_by']);
            $table->dropIndex(['attendance_status', 'status']);
            $table->dropColumn(['resolution_source', 'resolution_note', 'resolved_by', 'resolved_at']);
        });
    }
};