<?php

namespace App\Http\Controllers\Api\Salon;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\Shop;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OwnerAnalyticsController extends Controller
{
    public function summary(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $from = CarbonImmutable::parse($data['from'])->startOfDay();
        $to = CarbonImmutable::parse($data['to'])->endOfDay();

        $bookings = SalonBooking::query()
            ->where('shop_id', $shop->id)
            ->whereBetween('starts_at', [$from, $to]);

        $byStatus = (clone $bookings)->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        $revenue = (int) DB::table('salon_bookings')
            ->join('salon_services', 'salon_services.id', '=', 'salon_bookings.salon_service_id')
            ->where('salon_bookings.shop_id', $shop->id)
            ->where('salon_bookings.status', BookingStatus::Completed->value)
            ->whereBetween('salon_bookings.starts_at', [$from, $to])
            ->sum('salon_services.price_cents');

        $topServices = DB::table('salon_bookings')
            ->join('salon_services', 'salon_services.id', '=', 'salon_bookings.salon_service_id')
            ->where('salon_bookings.shop_id', $shop->id)
            ->whereBetween('salon_bookings.starts_at', [$from, $to])
            ->groupBy('salon_services.id', 'salon_services.name')
            ->selectRaw('salon_services.name as name, COUNT(*) as bookings')
            ->orderByDesc('bookings')
            ->limit(8)
            ->get();

        $topServicesRevenue = DB::table('salon_bookings')
            ->join('salon_services', 'salon_services.id', '=', 'salon_bookings.salon_service_id')
            ->where('salon_bookings.shop_id', $shop->id)
            ->where('salon_bookings.status', BookingStatus::Completed->value)
            ->whereBetween('salon_bookings.starts_at', [$from, $to])
            ->groupBy('salon_services.id', 'salon_services.name')
            ->selectRaw('salon_services.name as name, COUNT(*) as bookings, COALESCE(SUM(salon_services.price_cents),0) as revenue_cents')
            ->orderByDesc('revenue_cents')
            ->limit(8)
            ->get();

        $topStaff = DB::table('salon_bookings')
            ->join('salon_staff', 'salon_staff.id', '=', 'salon_bookings.salon_staff_id')
            ->where('salon_bookings.shop_id', $shop->id)
            ->whereBetween('salon_bookings.starts_at', [$from, $to])
            ->groupBy('salon_staff.id', 'salon_staff.name')
            ->selectRaw('salon_staff.name as name, COUNT(*) as bookings')
            ->orderByDesc('bookings')
            ->limit(8)
            ->get();

        $days = max(1, $from->diffInDays($to) + 1);
        $prevTo = $from->copy()->subDay()->endOfDay();
        $prevFrom = $prevTo->copy()->subDays($days - 1)->startOfDay();

        $prevBookings = SalonBooking::query()
            ->where('shop_id', $shop->id)
            ->whereBetween('starts_at', [$prevFrom, $prevTo])
            ->count();

        $prevRevenue = (int) DB::table('salon_bookings')
            ->join('salon_services', 'salon_services.id', '=', 'salon_bookings.salon_service_id')
            ->where('salon_bookings.shop_id', $shop->id)
            ->where('salon_bookings.status', BookingStatus::Completed->value)
            ->whereBetween('salon_bookings.starts_at', [$prevFrom, $prevTo])
            ->sum('salon_services.price_cents');

        $total = (clone $bookings)->count();
        $cancelled = (int) ($byStatus[BookingStatus::Cancelled->value] ?? 0)
            + (int) ($byStatus[BookingStatus::NoShow->value] ?? 0);
        $cancellation_rate = $total > 0 ? round(($cancelled / $total) * 1000) / 10 : 0.0;

        return response()->json([
            'data' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'total_bookings' => $total,
                'by_status' => $byStatus,
                'revenue_cents_completed' => $revenue,
                'top_services' => $topServices,
                'top_services_revenue' => $topServicesRevenue,
                'top_staff' => $topStaff,
                'comparison' => [
                    'from' => $prevFrom->toIso8601String(),
                    'to' => $prevTo->toIso8601String(),
                    'total_bookings' => $prevBookings,
                    'revenue_cents_completed' => $prevRevenue,
                ],
                'cancellation_rate_percent' => $cancellation_rate,
            ],
        ]);
    }

    private function shop(Request $request): Shop
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $shop = $user->resolveManagementShop($request);
        if ($shop === null) {
            abort(403, 'No shop.');
        }

        return $shop;
    }
}
