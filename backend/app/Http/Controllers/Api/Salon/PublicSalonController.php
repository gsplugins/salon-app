<?php

namespace App\Http\Controllers\Api\Salon;

use App\Enums\BookingSource;
use App\Enums\BookingStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\SalonService;
use App\Models\SalonStaff;
use App\Models\Shop;
use App\Models\User;
use App\Services\Salon\AvailabilityService;
use App\Support\MobileNormalizer;
use App\Support\SalonBookingPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class PublicSalonController extends Controller
{
    public function __construct(
        private readonly AvailabilityService $availability
    ) {}

    public function services(Shop $shop): JsonResponse
    {
        $rows = $shop->services()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'duration_minutes', 'buffer_after_minutes', 'price_cents']);

        return response()->json(['data' => $rows]);
    }

    public function staff(Request $request, Shop $shop): JsonResponse
    {
        $data = $request->validate([
            'service_id' => ['required', 'integer'],
        ]);

        $service = SalonService::query()
            ->where('shop_id', $shop->id)
            ->whereKey($data['service_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $rows = $service->staff()
            ->where('salon_staff.is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        $out = $rows->map(fn (SalonStaff $s) => [
            'id' => $s->id,
            'name' => $s->name,
        ]);

        $withAny = [
            ['id' => null, 'name' => 'Any available'],
            ...$out->all(),
        ];

        return response()->json(['data' => $withAny]);
    }

    public function availability(Request $request, Shop $shop): JsonResponse
    {
        $data = $request->validate([
            'service_id' => ['required', 'integer'],
            'date' => ['required', 'date_format:Y-m-d'],
            'staff_id' => ['nullable', 'integer'],
        ]);

        $service = SalonService::query()
            ->where('shop_id', $shop->id)
            ->whereKey($data['service_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $date = CarbonImmutable::createFromFormat('Y-m-d', $data['date'], config('app.timezone'));
        $staffId = isset($data['staff_id']) ? (int) $data['staff_id'] : null;

        $slots = $this->availability->availableStartTimes($service, $staffId, $date);

        return response()->json(['data' => $slots]);
    }

    public function storeBooking(Request $request, Shop $shop): JsonResponse
    {
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_mobile' => ['required', 'string', 'min:8', 'max:32'],
            'salon_service_id' => ['required', 'integer'],
            'salon_staff_id' => ['nullable', 'integer'],
            'starts_at' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $mobile = MobileNormalizer::normalize($data['customer_mobile']);
        if ($mobile === '') {
            throw ValidationException::withMessages([
                'customer_mobile' => ['Invalid mobile number.'],
            ]);
        }

        $actor = $request->user();
        $customerUserId = null;
        if ($actor instanceof User && $actor->role === UserRole::Customer) {
            $accountMobile = MobileNormalizer::normalize($actor->mobile ?? '');
            if ($accountMobile === '' || $accountMobile !== $mobile) {
                throw ValidationException::withMessages([
                    'customer_mobile' => ['Signed-in bookings must use your account mobile, or sign out to book as a guest.'],
                ]);
            }
            $customerUserId = $actor->id;
        }

        $service = SalonService::query()
            ->where('shop_id', $shop->id)
            ->whereKey($data['salon_service_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $starts = CarbonImmutable::parse($data['starts_at'])->timezone(config('app.timezone'));
        $duration = max(1, (int) $service->duration_minutes);
        $ends = $starts->copy()->addMinutes($duration);

        if ($starts->lt(now()->timezone(config('app.timezone')))) {
            throw ValidationException::withMessages([
                'starts_at' => ['That time is no longer available.'],
            ]);
        }

        $preferred = isset($data['salon_staff_id']) ? (int) $data['salon_staff_id'] : null;
        $staff = $this->availability->assignStaffForSlot($service, $preferred, $starts, null);
        if ($staff === null) {
            throw ValidationException::withMessages([
                'starts_at' => ['That time slot is no longer available.'],
            ]);
        }

        $booking = SalonBooking::query()->create([
            'shop_id' => $shop->id,
            'customer_user_id' => $customerUserId,
            'customer_name' => $data['customer_name'],
            'customer_mobile' => $mobile,
            'salon_service_id' => $service->id,
            'salon_staff_id' => $staff->id,
            'starts_at' => $starts,
            'ends_at' => $ends,
            'status' => BookingStatus::Pending,
            'source' => BookingSource::Online,
            'notes' => $data['notes'] ?? null,
        ]);

        $booking->load(['service:id,name,duration_minutes', 'staff:id,name']);

        return response()->json(['data' => SalonBookingPresenter::toArray($booking)], 201);
    }

    /**
     * @return array<string, mixed>
     */
    public function shopMeta(Shop $shop): JsonResponse
    {
        return response()->json([
            'data' => [
                'id' => $shop->id,
                'name' => $shop->name,
                'slug' => $shop->slug,
                'description' => $shop->description,
                'phone' => $shop->phone,
                'email' => $shop->email,
                'address' => $shop->address,
                'settings' => $shop->settings ?? (object) [],
            ],
        ]);
    }
}
