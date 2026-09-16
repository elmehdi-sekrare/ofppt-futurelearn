<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('teachers', 'subject')) {
            return; // Fresh installs no longer have the legacy subject column.
        }

        DB::table('teachers')->update(['subject' => null]);
    }

    public function down(): void
    {
        // Legacy subject values are intentionally not restored.
    }
};