<?php

namespace Database\Seeders;

use App\Enums\ShopRole;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Models\SalonService;
use App\Models\SalonStaff;
use App\Models\Shop;
use App\Models\ShopMember;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class SalonDemoSeeder extends Seeder
{
    public function run(): void
    {
        User::query()->updateOrCreate(
            ['mobile' => '5550000000'],
            [
                'name' => 'Super Admin',
                'email' => null,
                'password' => Hash::make('password'),
                'is_admin' => true,
                'role' => UserRole::SuperAdmin,
            ]
        );

        $owner = User::query()->updateOrCreate(
            ['mobile' => '5550000001'],
            [
                'name' => 'Salon Owner',
                'email' => null,
                'password' => Hash::make('password'),
                'is_admin' => false,
                'role' => UserRole::ShopOwner,
            ]
        );

        $shop = Shop::query()->firstOrCreate(
            ['slug' => 'demo'],
            [
                'user_id' => $owner->id,
                'name' => 'Demo shop',
                'description' => 'Sample shop for local development.',
                'is_active' => true,
                'settings' => null,
            ]
        );

        ShopMember::query()->updateOrCreate(
            ['user_id' => $owner->id, 'shop_id' => $shop->id],
            ['role' => ShopRole::Owner, 'is_active' => true]
        );

        $manager = User::query()->updateOrCreate(
            ['mobile' => '5550000002'],
            [
                'name' => 'Shop Manager',
                'email' => null,
                'password' => Hash::make('password'),
                'is_admin' => false,
                'role' => UserRole::Manager,
            ]
        );

        ShopMember::query()->updateOrCreate(
            ['user_id' => $manager->id, 'shop_id' => $shop->id],
            ['role' => ShopRole::Manager, 'is_active' => true]
        );

        Subscription::query()->updateOrCreate(
            ['shop_id' => $shop->id],
            [
                'plan_key' => 'starter',
                'status' => SubscriptionStatus::Active,
                'trial_ends_at' => null,
                'current_period_end' => now()->addYear(),
                'stripe_customer_id' => null,
                'stripe_subscription_id' => null,
            ]
        );

        $cut = SalonService::query()->updateOrCreate(
            ['shop_id' => $shop->id, 'name' => 'Cut & style'],
            ['duration_minutes' => 45, 'price_cents' => 6500, 'is_active' => true, 'sort_order' => 10]
        );
        $color = SalonService::query()->updateOrCreate(
            ['shop_id' => $shop->id, 'name' => 'Color & gloss'],
            ['duration_minutes' => 90, 'price_cents' => 12000, 'is_active' => true, 'sort_order' => 20]
        );
        $treatment = SalonService::query()->updateOrCreate(
            ['shop_id' => $shop->id, 'name' => 'Treatment'],
            ['duration_minutes' => 30, 'price_cents' => 4500, 'is_active' => true, 'sort_order' => 30]
        );

        $alex = SalonStaff::query()->updateOrCreate(
            ['shop_id' => $shop->id, 'name' => 'Alex'],
            ['is_active' => true, 'sort_order' => 10]
        );
        $jordan = SalonStaff::query()->updateOrCreate(
            ['shop_id' => $shop->id, 'name' => 'Jordan'],
            ['is_active' => true, 'sort_order' => 20]
        );

        $cut->staff()->syncWithoutDetaching([$alex->id, $jordan->id]);
        $color->staff()->syncWithoutDetaching([$alex->id, $jordan->id]);
        $treatment->staff()->syncWithoutDetaching([$jordan->id]);
    }
}
