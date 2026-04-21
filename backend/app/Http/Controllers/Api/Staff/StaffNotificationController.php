<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\StaffNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffNotificationController extends Controller
{
    use ResolvesStaffProfile;

    public function index(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $rows = StaffNotification::query()
            ->where('salon_staff_id', $staff->id)
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json([
            'data' => $rows->map(fn (StaffNotification $n) => [
                'id' => $n->id,
                'type' => $n->type,
                'title' => $n->title,
                'body' => $n->body,
                'metadata' => $n->metadata,
                'is_read' => $n->is_read,
                'created_at' => $n->created_at?->toIso8601String(),
            ]),
        ]);
    }

    public function markRead(Request $request, StaffNotification $notification): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        if ((int) $notification->salon_staff_id !== (int) $staff->id) {
            abort(404);
        }
        $notification->is_read = true;
        $notification->save();

        return response()->json(['data' => ['id' => $notification->id, 'is_read' => true]]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        StaffNotification::query()
            ->where('salon_staff_id', $staff->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return response()->json(['data' => ['ok' => true]]);
    }

    public function destroyAll(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        StaffNotification::query()->where('salon_staff_id', $staff->id)->delete();

        return response()->json(['data' => ['ok' => true]]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'email_alerts' => ['sometimes', 'boolean'],
            'sms_alerts' => ['sometimes', 'boolean'],
        ]);

        $settings = is_array($staff->portal_settings) ? $staff->portal_settings : [];
        if (isset($data['email_alerts'])) {
            $settings['email_alerts'] = $data['email_alerts'];
        }
        if (isset($data['sms_alerts'])) {
            $settings['sms_alerts'] = $data['sms_alerts'];
        }
        $staff->portal_settings = $settings;
        $staff->save();

        return response()->json(['data' => $staff->portal_settings]);
    }
}
