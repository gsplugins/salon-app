<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shops', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('slug')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->json('settings')->nullable();
            $table->timestamps();
        });

        Schema::create('subscriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->string('plan_key', 64)->default('starter');
            $table->string('status', 32)->default('trialing');
            $table->timestamp('trial_ends_at')->nullable();
            $table->timestamp('current_period_end')->nullable();
            $table->string('stripe_customer_id')->nullable();
            $table->string('stripe_subscription_id')->nullable();
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->string('role', 32)->default('customer')->after('is_admin');
        });

        DB::table('users')->where('is_admin', true)->update(['role' => 'barber']);

        foreach (['salon_services', 'salon_staff', 'salon_bookings', 'salon_blocked_slots'] as $tbl) {
            Schema::table($tbl, function (Blueprint $table) {
                $table->unsignedBigInteger('shop_id')->nullable()->after('id');
            });
        }

        $ownerId = DB::table('users')->where('role', 'barber')->orderBy('id')->value('id')
            ?? DB::table('users')->orderBy('id')->value('id');

        if ($ownerId !== null) {
            $shopId = DB::table('shops')->insertGetId([
                'user_id' => $ownerId,
                'name' => 'Demo shop',
                'slug' => 'demo',
                'description' => null,
                'is_active' => true,
                'settings' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            DB::table('subscriptions')->insert([
                'shop_id' => $shopId,
                'plan_key' => 'starter',
                'status' => 'active',
                'trial_ends_at' => null,
                'current_period_end' => now()->addYear(),
                'stripe_customer_id' => null,
                'stripe_subscription_id' => null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            foreach (['salon_services', 'salon_staff', 'salon_bookings', 'salon_blocked_slots'] as $tbl) {
                if (Schema::hasTable($tbl)) {
                    DB::table($tbl)->whereNull('shop_id')->update(['shop_id' => $shopId]);
                }
            }
        }

        foreach (['salon_services', 'salon_staff', 'salon_bookings', 'salon_blocked_slots'] as $tbl) {
            Schema::table($tbl, function (Blueprint $table) {
                $table->foreign('shop_id')->references('id')->on('shops')->restrictOnDelete();
            });
        }
    }

    public function down(): void
    {
        foreach (['salon_bookings', 'salon_blocked_slots', 'salon_services', 'salon_staff'] as $tbl) {
            Schema::table($tbl, function (Blueprint $table) {
                $table->dropForeign(['shop_id']);
                $table->dropColumn('shop_id');
            });
        }

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('role');
        });

        Schema::dropIfExists('subscriptions');
        Schema::dropIfExists('shops');
    }
};
