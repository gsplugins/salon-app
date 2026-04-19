<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salon_bookings', function (Blueprint $table) {
            $table->id();
            $table->string('customer_name');
            $table->string('customer_mobile', 32);
            $table->foreignId('salon_service_id')->constrained('salon_services')->restrictOnDelete();
            $table->foreignId('salon_staff_id')->constrained('salon_staff')->restrictOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('status', 32);
            $table->string('source', 32)->default('online');
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['starts_at', 'ends_at']);
            $table->index(['salon_staff_id', 'starts_at']);
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salon_bookings');
    }
};
