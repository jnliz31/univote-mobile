<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The elections.election_type enum was originally created with the value
     * 'campus', but the whole application (validation, UI and queries) uses
     * 'all' for campus-wide elections. Inserting 'all' into the old enum made
     * MySQL truncate the value (SQLSTATE 01000 / 1265). This migration aligns
     * the column with the values the app actually writes.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('elections', 'election_type')) {
            return;
        }

        // 1. Widen the enum first so existing 'campus' rows remain valid while
        //    the column is being changed.
        Schema::table('elections', function (Blueprint $table) {
            $table->enum('election_type', ['all', 'campus', 'organization', 'course'])
                  ->default('all')
                  ->change();
        });

        // 2. Normalize legacy 'campus' values to the canonical 'all'.
        DB::table('elections')
            ->where('election_type', 'campus')
            ->update(['election_type' => 'all']);

        // 3. Finalize the enum with only the values the application uses.
        Schema::table('elections', function (Blueprint $table) {
            $table->enum('election_type', ['all', 'organization', 'course'])
                  ->default('all')
                  ->change();
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('elections', 'election_type')) {
            return;
        }

        Schema::table('elections', function (Blueprint $table) {
            $table->enum('election_type', ['campus', 'organization', 'course'])
                  ->default('campus')
                  ->change();
        });
    }
};
