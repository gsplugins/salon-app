<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salon_blocked_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salon_staff_id')->nullable()->constrained('salon_staff')->nullOnDelete();
            $table->dateTime('starts_at');
            $table->dateTime('ends_at');
            $table->string('kind', 32);
            $table->string('reason')->nullable();
            $table->timestamps();

            $table->index(['starts_at', 'ends_at']);
            $table->index('salon_staff_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salon_blocked_slots');
    }
};
