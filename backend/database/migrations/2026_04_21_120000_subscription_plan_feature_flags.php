<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('subscription_plans')) {
            return;
        }

        $rows = DB::table('subscription_plans')->select('id', 'slug', 'features')->get();
        foreach ($rows as $row) {
            $f = [];
            if ($row->features !== null && $row->features !== '') {
                $decoded = json_decode((string) $row->features, true);
                $f = is_array($decoded) ? $decoded : [];
            }
            $slug = (string) $row->slug;
            $f['loyalty_enabled'] = in_array($slug, ['pro', 'enterprise'], true);
            $f['multi_branch_enabled'] = ($f['max_branches'] ?? 1) > 1;
            DB::table('subscription_plans')->where('id', $row->id)->update([
                'features' => json_encode($f),
            ]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('subscription_plans')) {
            return;
        }

        $rows = DB::table('subscription_plans')->select('id', 'features')->get();
        foreach ($rows as $row) {
            $f = [];
            if ($row->features !== null && $row->features !== '') {
                $decoded = json_decode((string) $row->features, true);
                $f = is_array($decoded) ? $decoded : [];
            }
            unset($f['loyalty_enabled'], $f['multi_branch_enabled']);
            DB::table('subscription_plans')->where('id', $row->id)->update([
                'features' => json_encode($f),
            ]);
        }
    }
};
