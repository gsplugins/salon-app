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
            'settings.website' => ['nullable', 'string', 'max:500'],
            'settings.logo_url' => ['nullable', 'string', 'max:1024'],
            'settings.cover_photo_url' => ['nullable', 'string', 'max:1024'],
            'settings.holidays' => ['nullable', 'array'],
            'settings.holidays.*.date' => ['required_with:settings.holidays', 'date_format:Y-m-d'],
            'settings.holidays.*.note' => ['nullable', 'string', 'max:255'],
            'settings.booking_rules' => ['nullable', 'array'],
            'settings.booking_rules.online_booking_enabled' => ['nullable', 'boolean'],
            'settings.booking_rules.booking_window_days' => ['nullable', 'integer', 'min:1', 'max:365'],
            'settings.booking_rules.min_notice_hours' => ['nullable', 'integer', 'min:0', 'max:168'],
            'settings.booking_rules.auto_confirm' => ['nullable', 'boolean'],
            'settings.booking_rules.buffer_between_minutes' => ['nullable', 'integer', 'min:0', 'max:240'],
            'settings.booking_rules.max_per_slot' => ['nullable', 'integer', 'min:1', 'max:50'],
            'settings.booking_rules.cancellation_deadline_hours' => ['nullable', 'integer', 'min:0', 'max:720'],
            'settings.booking_rules.cancellation_penalty_note' => ['nullable', 'string', 'max:2000'],
            'settings.booking_rules.custom_fields' => ['nullable', 'array'],
            'settings.booking_rules.custom_fields.*.key' => ['required_with:settings.booking_rules.custom_fields', 'string', 'max:64'],
            'settings.booking_rules.custom_fields.*.label' => ['nullable', 'string', 'max:128'],
            'settings.booking_rules.custom_fields.*.required' => ['nullable', 'boolean'],
            'settings.notification_preferences' => ['nullable', 'array'],
            'settings.notification_preferences.reminder_hours_before' => ['nullable', 'integer', 'min:0', 'max:168'],
            'settings.notification_preferences.sms_enabled' => ['nullable', 'boolean'],
            'settings.notification_preferences.email_enabled' => ['nullable', 'boolean'],
            'settings.notification_preferences.whatsapp_enabled' => ['nullable', 'boolean'],
            'settings.notification_templates' => ['nullable', 'array'],
            'settings.notification_templates.booking_confirmation' => ['nullable', 'string', 'max:5000'],
            'settings.notification_templates.cancellation' => ['nullable', 'string', 'max:5000'],
            'settings.notification_templates.review_request' => ['nullable', 'string', 'max:5000'],
            'settings.loyalty' => ['nullable', 'array'],
            'settings.loyalty.points_per_spend_cents' => ['nullable', 'integer', 'min:1', 'max:100000000'],
            'settings.loyalty.points_redeem_ratio' => ['nullable', 'numeric', 'min:0'],
            'settings.loyalty.is_active' => ['nullable', 'boolean'],
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

        $fresh = $shop->fresh();
        if ($fresh === null) {
            abort(500);
        }

        return response()->json(['data' => $this->shopPayload($fresh)]);
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
        $isBarber = $role === UserRole::Barber;
        $canManagePayments = $user instanceof User && ! $isBarber;
        $canViewSubscription = $user instanceof User && $user->canViewShopBilling($shop);

        $shop->loadMissing('subscription.plan');
        $sub = $shop->subscription;
        $plan = $sub?->plan;
        $features = is_array($plan?->features) ? $plan->features : [];

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
            'subscription' => $sub === null ? null : [
                'status' => $sub->status instanceof \BackedEnum ? $sub->status->value : (string) $sub->status,
                'plan_key' => $sub->plan_key,
                'plan_name' => $plan?->name,
                'trial_ends_at' => $sub->trial_ends_at?->toIso8601String(),
                'current_period_end' => $sub->current_period_end?->toIso8601String(),
                'features' => $features,
            ],
            'permissions' => [
                'can_edit_shop_basics' => $canEditShopBasics,
                'can_edit_business_hours' => $canEditBusinessHours,
                'can_edit_booking_rules' => $canEditBusinessHours,
                'can_edit_currency' => $canEditCurrency,
                'can_manage_payments' => $canManagePayments,
                'can_view_subscription' => $canViewSubscription,
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

        $shop = $user->resolveManagementShop($request);
        if ($shop === null) {
            abort(403, 'No shop.');
        }

        return $shop;
    }
}
