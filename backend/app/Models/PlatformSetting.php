<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PlatformSetting extends Model
{
    protected $fillable = [
        'platform_name',
        'logo_url',
        'favicon_url',
        'default_locale',
        'default_timezone',
        'maintenance_mode',
        'support_email',
        'support_phone',
        'support_info',
        'email_notifications_enabled',
        'sms_notifications_enabled',
        'integrations',
        'role_permissions',
    ];

    /**
     * @return array<string, string|bool|array<string, mixed>|null>
     */
    protected function casts(): array
    {
        return [
            'maintenance_mode' => 'boolean',
            'email_notifications_enabled' => 'boolean',
            'sms_notifications_enabled' => 'boolean',
            'integrations' => 'array',
            'role_permissions' => 'array',
        ];
    }

    public static function singleton(): self
    {
        $row = static::query()->orderBy('id')->first();
        if ($row !== null) {
            return $row;
        }

        return static::query()->create([
            'platform_name' => 'Salon',
            'default_locale' => 'en',
            'default_timezone' => 'UTC',
            'integrations' => [],
        ]);
    }
}
