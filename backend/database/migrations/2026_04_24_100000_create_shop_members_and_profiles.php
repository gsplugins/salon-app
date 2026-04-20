<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('shop_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->string('role', 32);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['user_id', 'shop_id']);
            $table->index(['shop_id', 'role']);
        });

        Schema::create('customer_profiles', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->string('display_name')->nullable();
            $table->string('email')->nullable();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('phone', 64)->nullable();
            $table->string('avatar_url', 2048)->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('gender', 32)->nullable();
            $table->string('preferred_language', 16)->default('en');
            $table->json('default_address')->nullable();
            $table->json('notification_preferences')->nullable();
            $table->json('wishlist')->nullable();
            $table->unsignedInteger('loyalty_points')->default(0);
            $table->unsignedInteger('wallet_balance_cents')->default(0);
            $table->timestamp('last_active_at')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->unique(['user_id', 'shop_id']);
            $table->index('shop_id');
        });

        Schema::create('shop_invitations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('shop_id')->constrained()->cascadeOnDelete();
            $table->string('email');
            $table->string('role', 32);
            $table->string('token_hash', 64)->unique();
            $table->foreignId('invited_by_user_id')->constrained('users')->cascadeOnDelete();
            $table->timestamp('expires_at');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();

            $table->index(['shop_id', 'email']);
        });

        $this->backfillShopOwners();
    }

    private function backfillShopOwners(): void
    {
        $shops = DB::table('shops')->select('id', 'user_id')->get();
        $now = now();
        foreach ($shops as $row) {
            DB::table('shop_members')->insert([
                'user_id' => $row->user_id,
                'shop_id' => $row->id,
                'role' => 'owner',
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('shop_invitations');
        Schema::dropIfExists('customer_profiles');
        Schema::dropIfExists('shop_members');
    }
};
