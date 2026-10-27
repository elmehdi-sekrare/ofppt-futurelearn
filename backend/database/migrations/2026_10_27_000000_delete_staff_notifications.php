<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Admins and trainers no longer receive notifications: one was created
     * for every absence, and the thousands that piled up slowed their
     * accounts down. Students keep theirs.
     */
    public function up(): void
    {
        DB::table('notifications')
            ->whereIn('user_id', DB::table('users')->whereIn('role', ['admin', 'teacher'])->select('id'))
            ->delete();
    }

    public function down(): void
    {
        // Deleted notifications cannot be restored.
    }
};
