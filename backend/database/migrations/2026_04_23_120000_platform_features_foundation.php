<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('loyalty_points')->default(0)->after('is_locked');
            $table->string('google_id')->nullable()->unique()->after('loyalty_points');
        });

        Schema::table('shops', function (Blueprint $table) {
            $table->foreignId('parent_shop_id')->nullable()->after('user_id')->constrained('shops')->nullOnDelete();
            $table->decimal('latitude', 10, 7)->nullable()->after('address');
            $table->decimal('longitude', 10, 7)->nullable()->after('latitude');
            $table->json('photos')->nullable()->after('longitude');
        });

        Schema::table('salon_staff', function (Blueprint $table) {
            $table->foreignId('user_id')->nullable()->after('shop_id')->constrained()->nullOnDelete();
            $table->text('bio')->nullable()->after('name');
            $table->json('specialties')->nullable()->after('bio');
            $table->string('photo_url')->nullable()->after('specialties');
            $table->json('weekly_schedule')->nullable()->after('photo_url');
        });

        Schema::table('salon_bookings', function (Blueprint $table) {
            $table->foreignId('customer_user_id')->nullable()->after('shop_id')->constrained('users')->nullOnDelete();
        });

        Schema::create('salon_queue_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->foreignId('salon_staff_id')->nullable()->constrained('salon_staff')->nullOnDelete();
            $table->foreignId('customer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('customer_name')->nullable();
            $table->string('customer_mobile', 32)->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->unsignedInteger('estimated_wait_minutes')->nullable();
            $table->string('status', 32)->default('waiting');
            $table->timestamp('join_time')->useCurrent();
            $table->timestamps();
        });

        Schema::create('salon_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->foreignId('salon_staff_id')->nullable()->constrained('salon_staff')->nullOnDelete();
            $table->foreignId('salon_booking_id')->nullable()->constrained('salon_bookings')->nullOnDelete();
            $table->foreignId('customer_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->unsignedTinyInteger('rating');
            $table->text('comment')->nullable();
            $table->text('owner_reply')->nullable();
            $table->timestamp('flagged_at')->nullable();
            $table->timestamps();
        });

        Schema::create('loyalty_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->integer('points');
            $table->string('type', 32);
            $table->string('description')->nullable();
            $table->foreignId('salon_booking_id')->nullable()->constrained('salon_bookings')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('inventory_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->string('name');
            $table->decimal('quantity', 12, 2)->default(0);
            $table->string('unit', 32)->default('unit');
            $table->decimal('low_stock_threshold', 12, 2)->nullable();
            $table->timestamps();
        });

        Schema::create('salon_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->foreignId('salon_booking_id')->nullable()->constrained('salon_bookings')->nullOnDelete();
            $table->string('method', 32);
            $table->unsignedInteger('amount_cents');
            $table->string('currency', 8)->default('USD');
            $table->string('transaction_id')->nullable();
            $table->string('status', 32)->default('pending');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        // Legacy "barber" shop owners become shop_owner (staff barbers use role barber later)
        if (Schema::hasTable('users') && Schema::hasTable('shops')) {
            DB::table('users')
                ->where('role', 'barber')
                ->whereExists(function ($q) {
                    $q->selectRaw('1')->from('shops')->whereColumn('shops.user_id', 'users.id');
                })
                ->update(['role' => 'shop_owner']);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('salon_payments');
        Schema::dropIfExists('inventory_items');
        Schema::dropIfExists('loyalty_transactions');
        Schema::dropIfExists('salon_reviews');
        Schema::dropIfExists('salon_queue_entries');

        Schema::table('salon_bookings', function (Blueprint $table) {
            $table->dropConstrainedForeignId('customer_user_id');
        });

        Schema::table('salon_staff', function (Blueprint $table) {
            $table->dropConstrainedForeignId('user_id');
            $table->dropColumn(['bio', 'specialties', 'photo_url', 'weekly_schedule']);
        });

        Schema::table('shops', function (Blueprint $table) {
            $table->dropConstrainedForeignId('parent_shop_id');
            $table->dropColumn(['latitude', 'longitude', 'photos']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['loyalty_points', 'google_id']);
        });
    }
};
