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

        return response()->json([
            'data' => [
                'from' => $from->toIso8601String(),
                'to' => $to->toIso8601String(),
                'total_bookings' => (clone $bookings)->count(),
                'by_status' => $byStatus,
                'revenue_cents_completed' => $revenue,
                'top_services' => $topServices,
            ],
        ]);
    }

    private function shop(Request $request): Shop
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $shop = $user->managementShop();
        if ($shop === null) {
            abort(403, 'No shop.');
        }

        return $shop;
    }
}
