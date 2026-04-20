<?php

namespace App\Http\Controllers\Api\Salon;

use App\Enums\BookingStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BarberShopProfileController extends Controller
{
    public function show(Request $request): JsonResponse
    {
        $shop = $this->shop($request);

        return response()->json(['data' => $this->shopPayload($shop)]);
    }

    public function update(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $actor = $this->userOrAbort($request);
        $isBarberOnly = $actor->role === UserRole::Barber;

        if ($isBarberOnly) {
            return response()->json([
                'message' => 'Salon staff cannot edit shop-wide settings. Ask a manager or owner.',
            ], 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'phone' => ['nullable', 'string', 'max:32'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'settings' => ['nullable', 'array'],
            'settings.business_hours' => ['nullable', 'array'],
            'settings.business_hours.mon' => ['nullable', 'array'],
            'settings.business_hours.tue' => ['nullable', 'array'],
            'settings.business_hours.wed' => ['nullable', 'array'],
            'settings.business_hours.thu' => ['nullable', 'array'],
            'settings.business_hours.fri' => ['nullable', 'array'],
            'settings.business_hours.sat' => ['nullable', 'array'],
            'settings.business_hours.sun' => ['nullable', 'array'],
            'settings.min_lead_time_hours' => ['nullable', 'integer', 'min:0', 'max:168'],
            'settings.currency' => ['nullable', 'string', 'max:8'],
        ]);

        if ($actor instanceof User && $actor->role === UserRole::Manager) {
            unset($data['email']);
            if (isset($data['settings']) && is_array($data['settings'])) {
                unset($data['settings']['currency']);
            }
        }

        if (isset($data['name'])) {
            $shop->name = $data['name'];
        }
        if (array_key_exists('description', $data)) {
            $shop->description = $data['description'];
        }
        if (array_key_exists('phone', $data)) {
            $shop->phone = $data['phone'];
        }
        if (array_key_exists('email', $data)) {
            $shop->email = $data['email'];
        }
        if (array_key_exists('address', $data)) {
            $shop->address = $data['address'];
        }

        if (isset($data['settings']) && is_array($data['settings'])) {
            $shop->settings = array_replace_recursive($shop->settings ?? [], $data['settings']);
        }

        $shop->save();

        return response()->json(['data' => $this->shopPayload($shop->fresh())]);
    }

    public function stats(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $actor = $this->userOrAbort($request);
        $staffId = $actor->role === UserRole::Barber ? $actor->staffProfile?->id : null;
        $id = $shop->id;

        $todayStart = now()->startOfDay();
        $todayEnd = now()->copy()->endOfDay();
        $weekStart = now()->copy()->startOfWeek();
        $weekEnd = now()->copy()->endOfWeek();

        $bookingsTodayQ = SalonBooking::query()
            ->where('shop_id', $id)
            ->whereBetween('starts_at', [$todayStart, $todayEnd]);
        if ($staffId !== null) {
            $bookingsTodayQ->where('salon_staff_id', $staffId);
        }
        $bookingsToday = $bookingsTodayQ->count();

        $bookingsWeekQ = SalonBooking::query()
            ->where('shop_id', $id)
            ->whereBetween('starts_at', [$weekStart, $weekEnd]);
        if ($staffId !== null) {
            $bookingsWeekQ->where('salon_staff_id', $staffId);
        }
        $bookingsWeek = $bookingsWeekQ->count();

        $completedWeekQ = SalonBooking::query()
            ->where('shop_id', $id)
            ->where('status', BookingStatus::Completed)
            ->whereBetween('starts_at', [$weekStart, $weekEnd]);
        if ($staffId !== null) {
            $completedWeekQ->where('salon_staff_id', $staffId);
        }
        $completedWeek = $completedWeekQ->count();

        $pendingCountQ = SalonBooking::query()
            ->where('shop_id', $id)
            ->where('status', BookingStatus::Pending)
            ->where('starts_at', '>=', now());
        if ($staffId !== null) {
            $pendingCountQ->where('salon_staff_id', $staffId);
        }
        $pendingCount = $pendingCountQ->count();

        $revenueWeekQ = SalonBooking::query()
            ->where('salon_bookings.shop_id', $id)
            ->where('salon_bookings.status', BookingStatus::Completed)
            ->whereBetween('salon_bookings.starts_at', [$weekStart, $weekEnd])
            ->join('salon_services', 'salon_services.id', '=', 'salon_bookings.salon_service_id');
        if ($staffId !== null) {
            $revenueWeekQ->where('salon_bookings.salon_staff_id', $staffId);
        }
        $revenueWeek = (int) $revenueWeekQ->sum('salon_services.price_cents');

        return response()->json([
            'data' => [
                'bookings_today' => $bookingsToday,
                'bookings_this_week' => $bookingsWeek,
                'completed_this_week' => $completedWeek,
                'pending_upcoming' => $pendingCount,
                'estimated_revenue_cents_this_week' => $revenueWeek,
            ],
        ]);
    }

    public function clients(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $actor = $this->userOrAbort($request);
        $staffId = $actor->role === UserRole::Barber ? $actor->staffProfile?->id : null;

        $rowsQ = DB::table('salon_bookings')
            ->where('shop_id', $shop->id)
            ->selectRaw('customer_mobile, MAX(customer_name) as customer_name, COUNT(*) as visit_count, MAX(starts_at) as last_visit_at')
            ->groupBy('customer_mobile')
            ->orderByDesc('last_visit_at')
            ->limit(200);
        if ($staffId !== null) {
            $rowsQ->where('salon_staff_id', $staffId);
        }
        $rows = $rowsQ->get();

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'customer_mobile' => $r->customer_mobile,
                'customer_name' => $r->customer_name,
                'visit_count' => (int) $r->visit_count,
                'last_visit_at' => $r->last_visit_at,
            ]),
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function shopPayload(Shop $shop): array
    {
        $user = request()->user();
        $role = $user instanceof User ? $user->role : null;
        $canEditShopBasics = $role !== UserRole::Barber;
        $canEditBusinessHours = $role === UserRole::ShopOwner || $role === UserRole::Manager;
        $canEditCurrency = $role === UserRole::ShopOwner;

        return [
            'id' => $shop->id,
            'name' => $shop->name,
            'slug' => $shop->slug,
            'description' => $shop->description,
            'phone' => $shop->phone,
            'email' => $shop->email,
            'address' => $shop->address,
            'is_active' => $shop->is_active,
            'settings' => $shop->settings ?? (object) [],
            'permissions' => [
                'can_edit_shop_basics' => $canEditShopBasics,
                'can_edit_business_hours' => $canEditBusinessHours,
                'can_edit_booking_rules' => $canEditBusinessHours,
                'can_edit_currency' => $canEditCurrency,
            ],
        ];
    }

    private function userOrAbort(Request $request): User
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $user->loadMissing('staffProfile');

        return $user;
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
