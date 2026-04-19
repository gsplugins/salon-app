<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('shops', function (Blueprint $table) {
            $table->string('phone', 32)->nullable()->after('description');
            $table->string('email')->nullable();
            $table->text('address')->nullable();
        });

        Schema::table('salon_services', function (Blueprint $table) {
            $table->string('category', 64)->nullable()->after('name');
            $table->unsignedSmallInteger('buffer_after_minutes')->default(0)->after('duration_minutes');
        });
    }

    public function down(): void
    {
        Schema::table('salon_services', function (Blueprint $table) {
            $table->dropColumn(['category', 'buffer_after_minutes']);
        });

        Schema::table('shops', function (Blueprint $table) {
            $table->dropColumn(['phone', 'email', 'address']);
        });
    }
};
