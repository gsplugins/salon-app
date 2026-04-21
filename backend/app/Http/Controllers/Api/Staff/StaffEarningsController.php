<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\StaffCommissionItem;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffEarningsController extends Controller
{
    use ResolvesStaffProfile;

    public function summary(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $tz = config('app.timezone');
        $from = isset($data['from'])
            ? CarbonImmutable::parse($data['from'])->timezone($tz)->startOfDay()
            : now()->timezone($tz)->startOfWeek();
        $to = isset($data['to'])
            ? CarbonImmutable::parse($data['to'])->timezone($tz)->endOfDay()
            : now()->timezone($tz)->endOfWeek();

        $commissionPct = (float) ($staff->commission_percent ?? 0);

        $rows = SalonBooking::query()
            ->where('salon_staff_id', $staff->id)
            ->where('status', BookingStatus::Completed)
            ->whereBetween('starts_at', [$from, $to])
            ->with(['service:id,name,price_cents'])
            ->orderByDesc('starts_at')
            ->limit(500)
            ->get();

        $breakdown = [];
        $totalCents = 0;
        foreach ($rows as $b) {
            $price = (int) ($b->service?->price_cents ?? 0);
            $comm = $commissionPct > 0 ? (int) round($price * $commissionPct / 100) : 0;
            $totalCents += $comm;

            $item = StaffCommissionItem::query()->where('salon_booking_id', $b->id)->first();
            $status = $item?->status ?? 'pending';

            $breakdown[] = [
                'booking_id' => $b->id,
                'starts_at' => $b->starts_at->toIso8601String(),
                'customer_name' => $b->customer_name,
                'service_name' => $b->service?->name,
                'price_cents' => $price,
                'commission_cents' => $comm,
                'commission_status' => $status,
            ];
        }

        $weekStart = now()->timezone($tz)->startOfWeek();
        $weekEnd = now()->timezone($tz)->endOfWeek();
        $monthStart = now()->timezone($tz)->startOfMonth();
        $monthEnd = now()->timezone($tz)->endOfMonth();

        $sumRange = function ($start, $end) use ($staff, $commissionPct): int {
            if ($commissionPct <= 0) {
                return 0;
            }
            $sum = (int) DB::table('salon_bookings')
                ->join('salon_services', 'salon_services.id', '=', 'salon_bookings.salon_service_id')
                ->where('salon_bookings.salon_staff_id', $staff->id)
                ->where('salon_bookings.status', BookingStatus::Completed->value)
                ->whereBetween('salon_bookings.starts_at', [$start, $end])
                ->sum('salon_services.price_cents');

            return (int) round($sum * $commissionPct / 100);
        };

        return response()->json([
            'data' => [
                'commission_percent' => $staff->commission_percent,
                'range' => [
                    'from' => $from->toIso8601String(),
                    'to' => $to->toIso8601String(),
                    'total_commission_cents' => $totalCents,
                ],
                'this_week_commission_cents_estimate' => $sumRange($weekStart, $weekEnd),
                'this_month_commission_cents_estimate' => $sumRange($monthStart, $monthEnd),
                'breakdown' => $breakdown,
            ],
        ]);
    }
}
