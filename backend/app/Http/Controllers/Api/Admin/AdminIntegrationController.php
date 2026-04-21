<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
class AdminIntegrationController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $s = PlatformSetting::singleton();

        return response()->json(['data' => $s->integrations ?? []]);
    }

    public function updateStripe(Request $request): JsonResponse
    {
        return $this->merge($request, 'stripe', [
            'publishable_key' => ['nullable', 'string', 'max:255'],
            'secret_key' => ['nullable', 'string', 'max:255'],
            'webhook_secret' => ['nullable', 'string', 'max:255'],
        ]);
    }

    public function updateGoogleCalendar(Request $request): JsonResponse
    {
        return $this->merge($request, 'google_calendar', [
            'enabled' => ['sometimes', 'boolean'],
            'client_id' => ['nullable', 'string', 'max:512'],
            'client_secret' => ['nullable', 'string', 'max:512'],
        ]);
    }

    public function updateWhatsapp(Request $request): JsonResponse
    {
        return $this->merge($request, 'whatsapp', [
            'enabled' => ['sometimes', 'boolean'],
        ]);
    }

    /**
     * @param  array<string, mixed>  $rules
     */
    private function merge(Request $request, string $key, array $rules): JsonResponse
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
