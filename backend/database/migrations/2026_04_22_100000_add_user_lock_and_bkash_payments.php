<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_locked')->default(false)->after('role');
        });

        Schema::create('bkash_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('amount_paisa')->default(0);
            $table->string('trx_id', 64)->nullable()->unique();
            $table->string('status', 32)->default('pending');
            $table->string('payer_mobile', 32)->nullable();
            $table->text('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bkash_payments');

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('is_locked');
        });
    }
};
