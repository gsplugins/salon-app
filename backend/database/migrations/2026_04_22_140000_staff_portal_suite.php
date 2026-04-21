<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('salon_staff')) {
            Schema::table('salon_staff', function (Blueprint $table) {
                if (! Schema::hasColumn('salon_staff', 'commission_percent')) {
                    $table->decimal('commission_percent', 5, 2)->nullable()->after('is_active');
                }
                if (! Schema::hasColumn('salon_staff', 'availability_status')) {
                    $table->string('availability_status', 32)->default('available')->after('commission_percent');
                }
                if (! Schema::hasColumn('salon_staff', 'portal_settings')) {
                    $table->json('portal_settings')->nullable()->after('availability_status');
                }
            });
        }

        Schema::create('staff_leave_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salon_staff_id')->constrained('salon_staff')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->date('date');
            $table->text('reason');
            $table->string('status', 24)->default('pending');
            $table->text('manager_note')->nullable();
            $table->timestamps();
            $table->index(['salon_staff_id', 'status']);
        });

        Schema::create('staff_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salon_staff_id')->constrained('salon_staff')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->string('type', 64);
            $table->string('title')->nullable();
            $table->text('body')->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamps();
            $table->index(['salon_staff_id', 'is_read']);
        });

        Schema::create('staff_availability_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salon_staff_id')->constrained('salon_staff')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->dateTimeTz('starts_at');
            $table->dateTimeTz('ends_at');
            $table->string('kind', 32)->default('custom');
            $table->text('note')->nullable();
            $table->timestamps();
            $table->index(['salon_staff_id', 'starts_at']);
        });

        Schema::create('staff_customer_notes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salon_staff_id')->constrained('salon_staff')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->string('customer_mobile', 32);
            $table->text('note');
            $table->timestamps();
            $table->index(['salon_staff_id', 'customer_mobile']);
        });

        Schema::create('staff_commission_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salon_staff_id')->constrained('salon_staff')->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained('shops')->cascadeOnDelete();
            $table->foreignId('salon_booking_id')->constrained('salon_bookings')->cascadeOnDelete();
            $table->unsignedInteger('amount_cents');
            $table->string('status', 24)->default('pending');
            $table->timestampTz('paid_at')->nullable();
            $table->timestamps();
            $table->unique('salon_booking_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('staff_commission_items');
        Schema::dropIfExists('staff_customer_notes');
        Schema::dropIfExists('staff_availability_blocks');
        Schema::dropIfExists('staff_notifications');
        Schema::dropIfExists('staff_leave_requests');

        if (Schema::hasTable('salon_staff')) {
            Schema::table('salon_staff', function (Blueprint $table) {
                foreach (['commission_percent', 'availability_status', 'portal_settings'] as $col) {
                    if (Schema::hasColumn('salon_staff', $col)) {
                        $table->dropColumn($col);
                    }
                }
            });
        }
    }
};
