<?php

namespace App\Http\Controllers\Api;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\User;
use App\Services\Salon\AvailabilityService;
use App\Support\MobileNormalizer;
use App\Support\SalonBookingPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CustomerPortalController extends Controller
{
    public function __construct(
        private readonly AvailabilityService $availability
    ) {}

    public function appointments(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $norm = MobileNormalizer::normalize($user->mobile ?? '');
        $rows = SalonBooking::query()
            ->where(function ($q) use ($user, $norm) {
                $q->where('customer_user_id', $user->id);
                if ($norm !== '') {
                    $q->orWhere('customer_mobile', $norm);
                }
            })
            ->with(['service:id,name,duration_minutes', 'staff:id,name', 'shop:id,name,slug'])
            ->orderByDesc('starts_at')
            ->limit(200)
            ->get();

        return response()->json([
            'data' => $rows->map(fn (SalonBooking $b) => SalonBookingPresenter::toArray($b))->values(),
        ]);
    }

    public function loyalty(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $user->loadMissing('loyaltyTransactions');

        return response()->json([
            'data' => [
                'points' => (int) ($user->loyalty_points ?? 0),
                'transactions' => $user->loyaltyTransactions()
                    ->orderByDesc('id')
                    ->limit(50)
                    ->get()
                    ->map(fn ($t) => [
                        'id' => $t->id,
                        'points' => $t->points,
                        'type' => $t->type,
                        'description' => $t->description,
                        'created_at' => $t->created_at?->toIso8601String(),
                    ]),
            ],
        ]);
    }

    public function updateBooking(Request $request, SalonBooking $booking): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        if (! $this->customerOwnsBooking($user, $booking)) {
            abort(404);
        }

        $data = $request->validate([
            'status' => ['sometimes', Rule::in(['cancelled', 'completed'])],
            'starts_at' => ['sometimes', 'date'],
            'salon_staff_id' => ['sometimes', 'nullable', 'integer'],
        ]);

        if (isset($data['status']) && $data['status'] === 'cancelled') {
            return response()->json([
                'data' => $this->cancelBookingForCustomer($booking),
            ]);
        }

        if (isset($data['status']) && $data['status'] === 'completed') {
            return response()->json([
                'data' => $this->completeBookingForCustomer($booking),
            ]);
        }

        if (isset($data['starts_at'])) {
            return response()->json([
                'data' => $this->rescheduleBookingForCustomer($booking, $data),
            ]);
        }

        throw ValidationException::withMessages([
            'starts_at' => ['Send status cancelled, or starts_at (and optional salon_staff_id) to reschedule.'],
        ]);
    }

    private function customerOwnsBooking(User $user, SalonBooking $booking): bool
    {
        if ((int) $booking->customer_user_id === (int) $user->id) {
            return true;
        }

        $norm = MobileNormalizer::normalize($user->mobile ?? '');

        return $norm !== '' && $booking->customer_mobile === $norm;
    }

    /**
     * @return array<string, mixed>
     */
    private function cancelBookingForCustomer(SalonBooking $booking): array
    {
        if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)) {
            throw ValidationException::withMessages([
                'status' => ['This booking cannot be cancelled online.'],
            ]);
        }

        if ($booking->starts_at->lt(now())) {
            throw ValidationException::withMessages([
                'status' => ['Past appointments cannot be cancelled online.'],
            ]);
        }

        $booking->status = BookingStatus::Cancelled;
        $booking->save();

        $booking->load(['service:id,name,category,duration_minutes,price_cents', 'staff:id,name', 'shop:id,name,slug']);

        return SalonBookingPresenter::toArray($booking);
    }

    /**
     * After the salon has confirmed the visit, the customer may mark it completed (e.g. after checkout).
     *
     * @return array<string, mixed>
     */
    private function completeBookingForCustomer(SalonBooking $booking): array
    {
        if ($booking->status !== BookingStatus::Confirmed) {
            throw ValidationException::withMessages([
                'status' => ['Only confirmed appointments can be marked completed from your account.'],
            ]);
        }

        $tz = config('app.timezone');
        if ($booking->starts_at->timezone($tz)->isFuture()) {
            throw ValidationException::withMessages([
                'status' => ['You can mark this complete once the appointment time has started.'],
            ]);
        }

        $booking->status = BookingStatus::Completed;
        $booking->save();

        $booking->load(['service:id,name,category,duration_minutes,price_cents', 'staff:id,name', 'shop:id,name,slug']);

        return SalonBookingPresenter::toArray($booking);
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    private function rescheduleBookingForCustomer(SalonBooking $booking, array $data): array
    {
        if (! in_array($booking->status, [BookingStatus::Pending, BookingStatus::Confirmed], true)) {
            throw ValidationException::withMessages([
                'starts_at' => ['This booking cannot be rescheduled online.'],
            ]);
        }

        $booking->loadMissing('service');
        $service = $booking->service;
        if ($service === null || ! $service->is_active) {
            throw ValidationException::withMessages([
                'starts_at' => ['This service is no longer available.'],
            ]);
        }

        $starts = CarbonImmutable::parse($data['starts_at'])->timezone(config('app.timezone'));
        if ($starts->lt(now()->timezone(config('app.timezone')))) {
            throw ValidationException::withMessages([
                'starts_at' => ['Choose a future time.'],
            ]);
        }

        $preferred = array_key_exists('salon_staff_id', $data)
            ? ($data['salon_staff_id'] !== null ? (int) $data['salon_staff_id'] : null)
            : (int) $booking->salon_staff_id;

        $staff = $this->availability->assignStaffForSlot($service, $preferred, $starts, (int) $booking->id);
        if ($staff === null) {
            throw ValidationException::withMessages([
                'starts_at' => ['That time slot is not available.'],
            ]);
        }

        $duration = max(1, (int) $service->duration_minutes);
        $ends = $starts->copy()->addMinutes($duration);

        $booking->salon_staff_id = $staff->id;
        $booking->starts_at = $starts;
        $booking->ends_at = $ends;
        $booking->save();

        $booking->load(['service:id,name,category,duration_minutes,price_cents', 'staff:id,name', 'shop:id,name,slug']);

        return SalonBookingPresenter::toArray($booking);
    }
}
