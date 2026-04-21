<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table) {
            $table->id();
            $table->string('platform_name')->default('Salon');
            $table->text('logo_url')->nullable();
            $table->text('favicon_url')->nullable();
            $table->string('default_locale', 16)->default('en');
            $table->string('default_timezone', 64)->default('UTC');
            $table->boolean('maintenance_mode')->default(false);
            $table->string('support_email')->nullable();
            $table->string('support_phone', 64)->nullable();
            $table->text('support_info')->nullable();
            $table->boolean('email_notifications_enabled')->default(true);
            $table->boolean('sms_notifications_enabled')->default(true);
            $table->json('integrations')->nullable();
            $table->json('role_permissions')->nullable();
            $table->timestamps();
        });

        Schema::create('subscription_plans', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 64)->unique();
            $table->string('name');
            $table->text('description')->nullable();
            $table->unsignedInteger('price_cents')->default(0);
            $table->string('currency', 8)->default('BDT');
            $table->string('billing_cycle', 16)->default('monthly');
            $table->unsignedSmallInteger('trial_days')->default(0);
            $table->json('features')->nullable();
            $table->boolean('is_active')->default(true);
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->timestamps();
        });

        if (Schema::hasTable('subscriptions')) {
            Schema::table('subscriptions', function (Blueprint $table) {
                $table->foreignId('subscription_plan_id')->nullable()->after('shop_id')->constrained('subscription_plans')->nullOnDelete();
            });
        }

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action', 191);
            $table->string('target_type', 64)->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->string('ip', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();
        });

        Schema::create('notification_templates', function (Blueprint $table) {
            $table->id();
            $table->string('template_key', 64)->unique();
            $table->string('channel', 16);
            $table->string('subject')->nullable();
            $table->text('body');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('admin_webhooks', function (Blueprint $table) {
            $table->id();
            $table->string('url');
            $table->string('secret')->nullable();
            $table->json('events')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->softDeletes();
        });

        DB::table('platform_settings')->insert([
            'platform_name' => 'Salon',
            'logo_url' => null,
            'favicon_url' => null,
            'default_locale' => 'en',
            'default_timezone' => 'Asia/Dhaka',
            'maintenance_mode' => false,
            'support_email' => null,
            'support_phone' => null,
            'support_info' => null,
            'email_notifications_enabled' => true,
            'sms_notifications_enabled' => true,
            'integrations' => json_encode([
                'smtp' => [
                    'host' => null,
                    'port' => 587,
                    'user' => null,
                    'password' => null,
                    'from' => null,
                    'encryption' => 'tls',
                ],
                'sms' => [
                    'provider' => 'twilio',
                    'twilio_sid' => null,
                    'twilio_token' => null,
                    'twilio_from' => null,
                ],
                'stripe' => [
                    'publishable_key' => null,
                    'secret_key' => null,
                    'webhook_secret' => null,
                ],
                'google_calendar' => [
                    'enabled' => false,
                    'client_id' => null,
                    'client_secret' => null,
                ],
                'whatsapp' => [
                    'enabled' => false,
                ],
            ]),
            'role_permissions' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $now = now();
        $plans = [
            ['slug' => 'free', 'name' => 'Free', 'description' => 'Try the basics', 'price_cents' => 0, 'billing_cycle' => 'monthly', 'trial_days' => 0, 'features' => ['max_staff' => 2, 'max_branches' => 1, 'sms_enabled' => false, 'analytics_enabled' => false], 'sort_order' => 10],
            ['slug' => 'starter', 'name' => 'Starter', 'description' => 'Default starter plan', 'price_cents' => 0, 'billing_cycle' => 'monthly', 'trial_days' => 14, 'features' => ['max_staff' => 30, 'max_branches' => 3, 'sms_enabled' => false, 'analytics_enabled' => true], 'sort_order' => 20],
            ['slug' => 'basic', 'name' => 'Basic', 'description' => 'Growing teams', 'price_cents' => 99900, 'billing_cycle' => 'monthly', 'trial_days' => 7, 'features' => ['max_staff' => 15, 'max_branches' => 2, 'sms_enabled' => true, 'analytics_enabled' => true], 'sort_order' => 30],
            ['slug' => 'pro', 'name' => 'Pro', 'description' => 'Full operations', 'price_cents' => 199900, 'billing_cycle' => 'monthly', 'trial_days' => 14, 'features' => ['max_staff' => 50, 'max_branches' => 10, 'sms_enabled' => true, 'analytics_enabled' => true], 'sort_order' => 40],
            ['slug' => 'enterprise', 'name' => 'Enterprise', 'description' => 'Custom limits', 'price_cents' => 499900, 'billing_cycle' => 'yearly', 'trial_days' => 30, 'features' => ['max_staff' => 500, 'max_branches' => 100, 'sms_enabled' => true, 'analytics_enabled' => true], 'sort_order' => 50],
        ];
        foreach ($plans as $p) {
            DB::table('subscription_plans')->insert([
                'slug' => $p['slug'],
                'name' => $p['name'],
                'description' => $p['description'],
                'price_cents' => $p['price_cents'],
                'currency' => 'BDT',
                'billing_cycle' => $p['billing_cycle'],
                'trial_days' => $p['trial_days'],
                'features' => json_encode($p['features']),
                'is_active' => true,
                'sort_order' => $p['sort_order'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        $templates = [
            ['template_key' => 'welcome_email', 'channel' => 'email', 'subject' => 'Welcome', 'body' => "Hi {{name}},\n\nWelcome to our salon platform."],
            ['template_key' => 'invoice_email', 'channel' => 'email', 'subject' => 'Your invoice', 'body' => "Hello {{name}},\n\nPlease find your invoice attached."],
            ['template_key' => 'suspension_warning_email', 'channel' => 'email', 'subject' => 'Account notice', 'body' => "Hi {{name}},\n\nYour shop access may be limited until billing is resolved."],
            ['template_key' => 'trial_expiry_email', 'channel' => 'email', 'subject' => 'Trial ending', 'body' => "Hi {{name}},\n\nYour trial ends on {{date}}."],
            ['template_key' => 'booking_sms', 'channel' => 'sms', 'subject' => null, 'body' => 'Reminder: appointment at {{shop}} on {{time}}.'],
        ];
        foreach ($templates as $t) {
            DB::table('notification_templates')->insert([
                'template_key' => $t['template_key'],
                'channel' => $t['channel'],
                'subject' => $t['subject'],
                'body' => $t['body'],
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        if (Schema::hasTable('subscriptions')) {
            $starterId = DB::table('subscription_plans')->where('slug', 'starter')->value('id');
            if ($starterId !== null) {
                DB::table('subscriptions')->where('plan_key', 'starter')->update(['subscription_plan_id' => $starterId]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });

        Schema::dropIfExists('admin_webhooks');
        Schema::dropIfExists('notification_templates');
        Schema::dropIfExists('audit_logs');

        if (Schema::hasTable('subscriptions')) {
            Schema::table('subscriptions', function (Blueprint $table) {
                $table->dropConstrainedForeignId('subscription_plan_id');
            });
        }

        Schema::dropIfExists('subscription_plans');
        Schema::dropIfExists('platform_settings');
    }
};
