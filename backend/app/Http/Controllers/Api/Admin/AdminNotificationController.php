<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\NotificationTemplate;
use App\Models\PlatformSetting;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminNotificationController extends Controller
{
    public function templates(): JsonResponse
    {
        $rows = NotificationTemplate::query()->orderBy('template_key')->get();

        return response()->json(['data' => $rows]);
    }

    public function updateTemplate(Request $request, NotificationTemplate $template): JsonResponse
    {
        $data = $request->validate([
            'subject' => ['nullable', 'string', 'max:255'],
            'body' => ['sometimes', 'string', 'max:50000'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $template->fill($data);
        $template->save();

        AdminAudit::record($request->user(), $request, 'notification_template.update', 'notification_template', (int) $template->id);

        return response()->json(['data' => $template->fresh()]);
    }

    public function updateGlobalToggles(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email_notifications_enabled' => ['sometimes', 'boolean'],
            'sms_notifications_enabled' => ['sometimes', 'boolean'],
        ]);

        $s = PlatformSetting::singleton();
        $s->fill($data);
        $s->save();

        AdminAudit::record($request->user(), $request, 'platform.notifications.toggles', 'platform_settings', (int) $s->id);

        return response()->json(['data' => [
            'email_notifications_enabled' => (bool) $s->email_notifications_enabled,
            'sms_notifications_enabled' => (bool) $s->sms_notifications_enabled,
        ]]);
    }

    public function updateSmtp(Request $request): JsonResponse
    {
        return $this->mergeIntegrations($request, 'smtp', [
            'host' => ['nullable', 'string', 'max:255'],
            'port' => ['nullable', 'integer', 'min:1', 'max:65535'],
            'user' => ['nullable', 'string', 'max:255'],
            'password' => ['nullable', 'string', 'max:255'],
            'from' => ['nullable', 'string', 'max:255'],
            'encryption' => ['nullable', Rule::in(['tls', 'ssl', 'none'])],
        ]);
    }

    public function updateSms(Request $request): JsonResponse
    {
        return $this->mergeIntegrations($request, 'sms', [
            'provider' => ['nullable', 'string', 'max:64'],
            'twilio_sid' => ['nullable', 'string', 'max:255'],
            'twilio_token' => ['nullable', 'string', 'max:255'],
            'twilio_from' => ['nullable', 'string', 'max:64'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $rules
     */
    private function mergeIntegrations(Request $request, string $key, array $rules): JsonResponse
    {
        $patch = $request->validate($rules);
        $s = PlatformSetting::singleton();
        $integrations = is_array($s->integrations) ? $s->integrations : [];
        $integrations[$key] = array_merge($integrations[$key] ?? [], $patch);
        $s->integrations = $integrations;
        $s->save();

        AdminAudit::record($request->user(), $request, 'platform.integrations.'.$key, 'platform_settings', (int) $s->id);

        return response()->json(['data' => $integrations[$key]]);
    }
}
