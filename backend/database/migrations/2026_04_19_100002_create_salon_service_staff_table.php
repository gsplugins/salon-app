<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salon_service_staff', function (Blueprint $table) {
            $table->id();
            $table->foreignId('salon_service_id')->constrained('salon_services')->cascadeOnDelete();
            $table->foreignId('salon_staff_id')->constrained('salon_staff')->cascadeOnDelete();
            $table->unique(['salon_service_id', 'salon_staff_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salon_service_staff');
    }
};
