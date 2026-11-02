<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The elections.election_type column was originally created as an enum with
     * the value 'campus', but the application (validation, UI and queries) uses
     * 'all' for campus-wide elections. This migration aligns the column with the
     * values the app actually writes.
     *
     * MySQL compiles enum() natively, so a Blueprint ->change() is enough there.
     * PostgreSQL does NOT: Laravel compiles enum() to a `varchar` column plus an
     * auto-named CHECK constraint, and ->change() emits
     * `alter column ... type varchar(255) check (...)`, which PostgreSQL rejects
     * as invalid syntax. The change therefore never applied on Postgres and the
     * stale `elections_election_type_check` constraint kept rejecting 'all'.
     * On Postgres we drop that constraint and convert the column to a plain
     * string instead (values are enforced by request validation).
     */
    public function up(): void
    {
        if (! Schema::hasColumn('elections', 'election_type')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'pgsql') {
            // Drop the auto-named CHECK constraint that enum() created.
            DB::statement('ALTER TABLE "elections" DROP CONSTRAINT IF EXISTS "elections_election_type_check"');

            // Convert to a plain string column so any enum value set by the app is accepted.
            DB::statement('ALTER TABLE "elections" ALTER COLUMN "election_type" TYPE varchar(255)');
            DB::statement('ALTER TABLE "elections" ALTER COLUMN "election_type" SET DEFAULT \'all\'');
            DB::statement('ALTER TABLE "elections" ALTER COLUMN "election_type" SET NOT NULL');
        } else {
            // 1. Widen the enum first so existing 'campus' rows remain valid while
            //    the column is being changed.
            Schema::table('elections', function (Blueprint $table) {
                $table->enum('election_type', ['all', 'campus', 'organization', 'course'])
                      ->default('all')
                      ->change();
            });
        }

        // 2. Normalize legacy 'campus' values to the canonical 'all'.
        DB::table('elections')
            ->where('election_type', 'campus')
            ->update(['election_type' => 'all']);

        if ($driver !== 'pgsql') {
            // 3. Finalize the enum with only the values the application uses.
            Schema::table('elections', function (Blueprint $table) {
                $table->enum('election_type', ['all', 'organization', 'course'])
                      ->default('all')
                      ->change();
            });
        }
    }

    public function down(): void
    {
        // Intentionally a no-op: reverting would re-introduce the constraint
        // values that break election creation on PostgreSQL.
    }
};
