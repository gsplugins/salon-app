<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminGeneralController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $s = PlatformSetting::singleton();

        return response()->json(['data' => $this->toPublicArray($s)]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'platform_name' => ['sometimes', 'string', 'max:255'],
            'logo_url' => ['nullable', 'string', 'max:2048'],
            'favicon_url' => ['nullable', 'string', 'max:2048'],
            'default_locale' => ['sometimes', 'string', 'max:16'],
            'default_timezone' => ['sometimes', 'string', 'max:64'],
            'maintenance_mode' => ['sometimes', 'boolean'],
            'support_email' => ['nullable', 'string', 'max:255'],
            'support_phone' => ['nullable', 'string', 'max:64'],
            'support_info' => ['nullable', 'string', 'max:10000'],
            'email_notifications_enabled' => ['sometimes', 'boolean'],
            'sms_notifications_enabled' => ['sometimes', 'boolean'],
        ]);

        $s = PlatformSetting::singleton();
        $s->fill($data);
        $s->save();

        AdminAudit::record($request->user(), $request, 'platform.general.update', 'platform_settings', (int) $s->id);

        return response()->json(['data' => $this->toPublicArray($s->fresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function toPublicArray(PlatformSetting $s): array
    {
        return [
            'id' => $s->id,
            'platform_name' => $s->platform_name,
            'logo_url' => $s->logo_url,
            'favicon_url' => $s->favicon_url,
            'default_locale' => $s->default_locale,
            'default_timezone' => $s->default_timezone,
            'maintenance_mode' => (bool) $s->maintenance_mode,
            'support_email' => $s->support_email,
            'support_phone' => $s->support_phone,
            'support_info' => $s->support_info,
            'email_notifications_enabled' => (bool) $s->email_notifications_enabled,
            'sms_notifications_enabled' => (bool) $s->sms_notifications_enabled,
            'integrations' => $s->integrations ?? [],
            'role_permissions' => $s->role_permissions,
        ];
    }
}
