<?php

namespace App\Http\Controllers\Api\Salon;

use App\Enums\BookingSource;
use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\SalonService;
use App\Models\Shop;
use App\Models\SalonStaff;
use App\Models\User;
use App\Services\Salon\AvailabilityService;
use App\Support\MobileNormalizer;
use App\Support\SalonBookingPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminSalonBookingController extends Controller
{
    public function __construct(
        private readonly AvailabilityService $availability
    ) {}

    public function index(Request $request): JsonResponse
    {
        $shop = $this->shopOrAbort($request);
        $actor = $this->userOrAbort($request);
        $staffScopeId = $this->staffScopeId($actor, $shop);
        $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(BookingStatus::values())],
        ]);

        $tz = config('app.timezone');
        $from = $request->query('from') !== null && $request->query('from') !== ''
            ? CarbonImmutable::parse((string) $request->query('from'))->timezone($tz)->startOfDay()
            : now()->timezone($tz)->subMonths(18)->startOfDay();
        $to = $request->query('to') !== null && $request->query('to') !== ''
            ? CarbonImmutable::parse((string) $request->query('to'))->timezone($tz)->endOfDay()
            : now()->timezone($tz)->addMonths(18)->endOfDay();

        if ($from->gt($to)) {
            throw ValidationException::withMessages([
                'from' => ['The from date must be before or equal to the to date.'],
            ]);
        }

        $maxDays = (int) config('salon.admin_bookings_max_range_days', 800);
        if ($from->diffInDays($to) > $maxDays) {
            throw ValidationException::withMessages([
                'to' => ["Date range cannot exceed {$maxDays} days. Narrow from/to or use filters."],
            ]);
        }

        $status = $request->query('status');
        $statusEnum = is_string($status) && $status !== ''
            ? BookingStatus::tryFrom($status)
            : null;
        if (is_string($status) && $status !== '' && $statusEnum === null) {
            throw ValidationException::withMessages([
                'status' => ['Invalid status filter.'],
            ]);
        }

        $q = SalonBooking::query()
            ->where('shop_id', $shop->id)
            ->with(['service:id,name,duration_minutes', 'staff:id,name'])
            ->where('starts_at', '<', $to)
            ->where('ends_at', '>', $from);

        if ($staffScopeId !== null) {
            $q->where('salon_staff_id', $staffScopeId);
        }

        if ($statusEnum !== null) {
            $q->where('status', $statusEnum);
        }

        $rows = $q->orderBy('starts_at')->limit(2000)->get();

        return response()->json([
            'data' => $rows->map(fn (SalonBooking $b) => SalonBookingPresenter::toArray($b))->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $shop = $this->shopOrAbort($request);
        $actor = $this->userOrAbort($request);
        $staffScopeId = $this->staffScopeId($actor, $shop);
        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_mobile' => ['required', 'string', 'min:8', 'max:32'],
            'salon_service_id' => ['required', 'integer'],
            'salon_staff_id' => [
                'nullable',
                'integer',
                Rule::exists('salon_staff', 'id')->where('shop_id', $shop->id),
            ],
            'starts_at' => ['required', 'date'],
            'status' => ['sometimes', Rule::enum(BookingStatus::class)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $mobile = MobileNormalizer::normalize($data['customer_mobile']);
        if ($mobile === '') {
            throw ValidationException::withMessages([
                'customer_mobile' => ['Invalid mobile number.'],
            ]);
        }

        $service = SalonService::query()
            ->where('shop_id', $shop->id)
            ->whereKey($data['salon_service_id'])
            ->where('is_active', true)
            ->firstOrFail();

        $starts = CarbonImmutable::parse($data['starts_at'])->timezone(config('app.timezone'));
        $duration = max(1, (int) $service->duration_minutes);
        $ends = $starts->copy()->addMinutes($duration);

        $preferred = $staffScopeId ?? (isset($data['salon_staff_id']) ? (int) $data['salon_staff_id'] : null);
        $staff = $this->availability->assignStaffForSlot($service, $preferred, $starts, null);
        if ($staff === null) {
            throw ValidationException::withMessages([
                'starts_at' => ['That time slot is not available.'],
            ]);
        }

        $status = $this->toBookingStatus($data['status'] ?? null) ?? BookingStatus::Confirmed;

        $booking = SalonBooking::query()->create([
            'shop_id' => $shop->id,
            'customer_name' => $data['customer_name'],
            'customer_mobile' => $mobile,
            'salon_service_id' => $service->id,
            'salon_staff_id' => $staff->id,
            'starts_at' => $starts,
            'ends_at' => $ends,
            'status' => $status,
            'source' => BookingSource::WalkIn,
            'notes' => $data['notes'] ?? null,
        ]);

        $booking->load(['service:id,name,duration_minutes', 'staff:id,name']);

        return response()->json(['data' => SalonBookingPresenter::toArray($booking)], 201);
    }

    public function update(Request $request, SalonBooking $booking): JsonResponse
    {
        $shop = $this->shopOrAbort($request);
        $actor = $this->userOrAbort($request);
        $staffScopeId = $this->staffScopeId($actor, $shop);
        if ((int) $booking->shop_id !== (int) $shop->id) {
            abort(404);
        }
        if ($staffScopeId !== null && (int) $booking->salon_staff_id !== $staffScopeId) {
            abort(403, 'You can only edit your own bookings.');
        }

        $data = $request->validate([
            'status' => ['sometimes', Rule::enum(BookingStatus::class)],
            'notes' => ['nullable', 'string', 'max:2000'],
            'starts_at' => ['sometimes', 'date'],
            'salon_staff_id' => [
                'sometimes',
                'nullable',
                'integer',
                Rule::exists('salon_staff', 'id')->where('shop_id', $shop->id),
            ],
        ]);

        if (isset($data['starts_at']) || array_key_exists('salon_staff_id', $data)) {
            $service = $booking->service;
            if (! $service->is_active) {
                throw ValidationException::withMessages([
                    'salon_service_id' => ['Service is inactive.'],
                ]);
            }

            $starts = isset($data['starts_at'])
                ? CarbonImmutable::parse($data['starts_at'])->timezone(config('app.timezone'))
                : $booking->starts_at->toImmutable();
            $duration = max(1, (int) $service->duration_minutes);
            $ends = $starts->copy()->addMinutes($duration);

            $preferred = $staffScopeId ?? (
                array_key_exists('salon_staff_id', $data)
                    ? ($data['salon_staff_id'] !== null ? (int) $data['salon_staff_id'] : null)
                    : (int) $booking->salon_staff_id
            );

            $staff = $this->availability->assignStaffForSlot($service, $preferred, $starts, (int) $booking->id);
            if ($staff === null) {
                throw ValidationException::withMessages([
                    'starts_at' => ['That time slot is not available.'],
                ]);
            }

            $booking->salon_staff_id = $staff->id;
            $booking->starts_at = $starts;
            $booking->ends_at = $ends;
        }

        if (isset($data['status'])) {
            $parsed = $this->toBookingStatus($data['status']);
            if ($parsed !== null) {
                if ($parsed === BookingStatus::Completed) {
                    if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)) {
                        throw ValidationException::withMessages([
                            'status' => ['Only pending or confirmed bookings can be marked completed.'],
                        ]);
                    }
                }
                $booking->status = $parsed;
            }
        }

        if (array_key_exists('notes', $data)) {
            $booking->notes = $data['notes'];
        }

        $booking->save();

        $booking->load(['service:id,name,duration_minutes', 'staff:id,name']);

        return response()->json(['data' => SalonBookingPresenter::toArray($booking)]);
    }

    private function shopOrAbort(Request $request): Shop
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

    private function userOrAbort(Request $request): User
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $user->loadMissing('staffProfile');

        return $user;
    }

    /**
     * Barber staff can only access their own bookings.
     */
    private function staffScopeId(User $user, Shop $shop): ?int
    {
        if ($user->role !== \App\Enums\UserRole::Barber) {
            return null;
        }
        $sp = $user->staffProfile;
        if (! $sp instanceof SalonStaff || (int) $sp->shop_id !== (int) $shop->id) {
            abort(403, 'No staff profile for this shop.');
        }

        return (int) $sp->id;
    }

    private function toBookingStatus(mixed $value): ?BookingStatus
    {
        if ($value === null) {
            return null;
        }

        if ($value instanceof BookingStatus) {
            return $value;
        }

        return BookingStatus::tryFrom((string) $value);
    }
}
