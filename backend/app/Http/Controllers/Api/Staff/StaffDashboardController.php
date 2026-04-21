<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffDashboardController extends Controller
{
    use ResolvesStaffProfile;

    public function show(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $staff->loadMissing(['shop:id,name,slug', 'user:id,name,mobile,email']);

        $start = now()->startOfDay();
        $end = now()->endOfDay();

        $todayBookings = SalonBooking::query()
            ->where('salon_staff_id', $staff->id)
            ->whereBetween('starts_at', [$start, $end])
            ->count();

        $commissionPct = (float) ($staff->commission_percent ?? 0);
        $todayEarningsCents = 0;
        if ($commissionPct > 0) {
            $sumCents = (int) DB::table('salon_bookings')
                ->join('salon_services', 'salon_services.id', '=', 'salon_bookings.salon_service_id')
                ->where('salon_bookings.salon_staff_id', $staff->id)
                ->where('salon_bookings.status', BookingStatus::Completed->value)
                ->whereBetween('salon_bookings.starts_at', [$start, $end])
                ->sum('salon_services.price_cents');
            $todayEarningsCents = (int) round($sumCents * $commissionPct / 100);
        }

        $next = SalonBooking::query()
            ->where('salon_staff_id', $staff->id)
            ->whereIn('status', [BookingStatus::Pending, BookingStatus::Confirmed])
            ->where('starts_at', '>=', now())
            ->with(['service:id,name,duration_minutes'])
            ->orderBy('starts_at')
            ->first();

        $nextPayload = null;
        if ($next !== null) {
            $nextPayload = [
                'id' => $next->id,
                'customer_name' => $next->customer_name,
                'starts_at' => $next->starts_at->toIso8601String(),
                'service' => [
                    'name' => $next->service?->name,
                ],
            ];
        }

        return response()->json([
            'data' => [
                'staff' => [
                    'id' => $staff->id,
                    'name' => $staff->name,
                    'photo_url' => $staff->photo_url,
                    'availability_status' => $staff->availability_status ?? 'available',
                    'commission_percent' => $staff->commission_percent,
                ],
                'shop' => $staff->shop ? [
                    'id' => $staff->shop->id,
                    'name' => $staff->shop->name,
                    'slug' => $staff->shop->slug,
                ] : null,
                'today_appointment_count' => $todayBookings,
                'today_commission_cents_estimate' => (int) $todayEarningsCents,
                'next_appointment' => $nextPayload,
            ],
        ]);
    }
}
