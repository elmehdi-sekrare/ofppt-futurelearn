<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Official OFPPT module titles run up to 125 characters in the
     * assignment workbook ("Utiliser les outils de l'électricien et le
     * matériel de manutention..."), so 100 characters truncated real names.
     */
    public function up(): void
    {
        Schema::table('modules', function (Blueprint $table) {
            $table->string('name', 191)->change();
        });
    }

    public function down(): void
    {
        Schema::table('modules', function (Blueprint $table) {
            $table->string('name', 100)->change();
        });
    }
};
