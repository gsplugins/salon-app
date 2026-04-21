<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\StaffAvailabilityBlock;
use App\Models\StaffLeaveRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffScheduleController extends Controller
{
    use ResolvesStaffProfile;

    public function show(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $staff->loadMissing('shop');
        $shop = $staff->shop;
        $settings = is_array($shop?->settings) ? $shop->settings : [];

        $leave = StaffLeaveRequest::query()
            ->where('salon_staff_id', $staff->id)
            ->orderByDesc('created_at')
            ->limit(60)
            ->get()
            ->map(fn (StaffLeaveRequest $r) => [
                'id' => $r->id,
                'date' => $r->date->toDateString(),
                'reason' => $r->reason,
                'status' => $r->status,
                'manager_note' => $r->manager_note,
            ]);

        $blocks = StaffAvailabilityBlock::query()
            ->where('salon_staff_id', $staff->id)
            ->where('starts_at', '>=', now()->subDays(1))
            ->orderBy('starts_at')
            ->limit(200)
            ->get()
            ->map(fn (StaffAvailabilityBlock $b) => [
                'id' => $b->id,
                'starts_at' => $b->starts_at->toIso8601String(),
                'ends_at' => $b->ends_at->toIso8601String(),
                'kind' => $b->kind,
                'note' => $b->note,
            ]);

        return response()->json([
            'data' => [
                'weekly_schedule' => $staff->weekly_schedule,
                'shop_business_hours' => $settings['business_hours'] ?? null,
                'shop_holidays' => $settings['holidays'] ?? [],
                'leave_requests' => $leave,
                'availability_blocks' => $blocks,
            ],
        ]);
    }
}
