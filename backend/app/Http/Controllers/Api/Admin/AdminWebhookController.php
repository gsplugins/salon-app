<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AdminWebhook;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminWebhookController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['data' => AdminWebhook::query()->orderByDesc('id')->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'url' => ['required', 'url', 'max:2048'],
            'secret' => ['nullable', 'string', 'max:255'],
            'events' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $row = AdminWebhook::query()->create([
            'url' => $data['url'],
            'secret' => $data['secret'] ?? null,
            'events' => $data['events'] ?? [],
            'is_active' => $data['is_active'] ?? true,
        ]);

        AdminAudit::record($request->user(), $request, 'webhook.create', 'admin_webhook', (int) $row->id);

        return response()->json(['data' => $row], 201);
    }

    public function update(Request $request, AdminWebhook $webhook): JsonResponse
    {
        $data = $request->validate([
            'url' => ['sometimes', 'url', 'max:2048'],
            'secret' => ['nullable', 'string', 'max:255'],
            'events' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $webhook->fill($data);
        $webhook->save();

        AdminAudit::record($request->user(), $request, 'webhook.update', 'admin_webhook', (int) $webhook->id);

        return response()->json(['data' => $webhook->fresh()]);
    }

    public function destroy(Request $request, AdminWebhook $webhook): JsonResponse
    {
        $id = (int) $webhook->id;
        $webhook->delete();

        AdminAudit::record($request->user(), $request, 'webhook.delete', 'admin_webhook', $id);

        return response()->json(['message' => 'Webhook removed.']);
    }

    public function test(Request $request, AdminWebhook $webhook): JsonResponse
    {
        AdminAudit::record($request->user(), $request, 'webhook.test', 'admin_webhook', (int) $webhook->id);

        return response()->json([
            'message' => 'Test ping not sent (configure queue/cHTTP client). URL registered: '.$webhook->url,
        ]);
    }
}
