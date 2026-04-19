<?php

namespace App\Services\Salon;

use App\Enums\BookingStatus;
use App\Models\SalonBlockedSlot;
use App\Models\SalonBooking;
use App\Models\SalonService;
use App\Models\SalonStaff;
use App\Support\ShopBusinessHours;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

final class AvailabilityService
{
    /**
     * @var list<BookingStatus>
     */
    private const RESERVING_STATUSES = [
        BookingStatus::Pending,
        BookingStatus::Confirmed,
    ];

    /**
     * @return list<string> ISO8601 start times available for booking
     */
    public function availableStartTimes(
        SalonService $service,
        ?int $staffId,
        CarbonImmutable $onDate
    ): array {
        $service->loadMissing('shop');
        $shop = $service->shop;
        if ($shop === null) {
            return [];
        }

        $open = ShopBusinessHours::dayOpenClose($shop, $onDate);
        if ($open === null) {
            return [];
        }

        [$dayStart, $dayEnd] = $open;
        $advanceDays = max(0, (int) config('salon.advance_booking_days', 60));
        $today = now()->toImmutable()->startOfDay();
        $lastBookable = $today->addDays($advanceDays);
        if ($onDate->lt($today) || $onDate->gt($lastBookable)) {
            return [];
        }

        $duration = max(1, (int) $service->duration_minutes);
        $step = max(5, (int) config('salon.slot_step_minutes', 15));

        /** @var Collection<int, SalonStaff> $candidates */
        $candidates = collect();
        if ($staffId !== null) {
            $one = SalonStaff::query()
                ->where('shop_id', $service->shop_id)
                ->whereKey($staffId)
                ->where('is_active', true)
                ->first();
            if ($one === null || ! $service->staff()->where('salon_staff.id', $one->id)->exists()) {
                return [];
            }
            $candidates = collect([$one]);
        } else {
            $candidates = $service->staff()->where('salon_staff.is_active', true)->orderBy('sort_order')->get();
        }

        if ($candidates->isEmpty()) {
            return [];
        }

        $slots = collect();
        $cursor = $dayStart->copy();
        while ($cursor->copy()->addMinutes($duration)->lte($dayEnd)) {
            $slotStart = $cursor->copy();

            foreach ($candidates as $staff) {
                if ($this->isIntervalBookable($service, $staff->id, $slotStart, null)) {
                    $slots->push($slotStart->toIso8601String());
                    break;
                }
            }

            $cursor = $cursor->addMinutes($step);
        }

        return $slots->unique()->sort()->values()->all();
    }

    public function assignStaffForSlot(
        SalonService $service,
        ?int $preferredStaffId,
        CarbonImmutable $startsAt,
        ?int $ignoreBookingId = null
    ): ?SalonStaff {
        $shopId = (int) $service->shop_id;

        if ($preferredStaffId !== null) {
            $staff = SalonStaff::query()
                ->where('shop_id', $shopId)
                ->whereKey($preferredStaffId)
                ->where('is_active', true)
                ->first();
            if ($staff === null || ! $service->staff()->where('salon_staff.id', $staff->id)->exists()) {
                return null;
            }
            if ($this->isIntervalBookable($service, $staff->id, $startsAt, $ignoreBookingId)) {
                return $staff;
            }

            return null;
        }

        $staffList = $service->staff()->where('salon_staff.is_active', true)->orderBy('sort_order')->get();

        foreach ($staffList as $staff) {
            if ($this->isIntervalBookable($service, $staff->id, $startsAt, $ignoreBookingId)) {
                return $staff;
            }
        }

        return null;
    }

    public function isIntervalBookable(
        SalonService $service,
        int $staffId,
        CarbonImmutable $startsAt,
        ?int $ignoreBookingId
    ): bool {
        $service->loadMissing('shop');
        $shop = $service->shop;
        if ($shop === null) {
            return false;
        }

        $duration = max(1, (int) $service->duration_minutes);
        $buffer = max(0, (int) $service->buffer_after_minutes);
        $serviceEnd = $startsAt->copy()->addMinutes($duration);
        $blockEnd = $startsAt->copy()->addMinutes($duration + $buffer);

        $day = $startsAt->toImmutable()->startOfDay();
        $open = ShopBusinessHours::dayOpenClose($shop, $day);
        if ($open === null) {
            return false;
        }
        [$dayStart, $dayEnd] = $open;
        if ($startsAt->lt($dayStart) || $serviceEnd->gt($dayEnd)) {
            return false;
        }

        if ($this->bookingOverlap($service->shop_id, $staffId, $startsAt, $blockEnd, $ignoreBookingId)) {
            return false;
        }

        return ! $this->blockedOverlap($service->shop_id, $staffId, $startsAt, $blockEnd);
    }

    private function bookingOverlap(
        int $shopId,
        int $staffId,
        CarbonInterface $newStart,
        CarbonInterface $newBlockEnd,
        ?int $ignoreBookingId
    ): bool {
        $bookings = SalonBooking::query()
            ->where('shop_id', $shopId)
            ->where('salon_staff_id', $staffId)
            ->whereIn('status', array_map(fn (BookingStatus $s) => $s->value, self::RESERVING_STATUSES))
            ->when($ignoreBookingId !== null, fn ($q) => $q->where('id', '!=', $ignoreBookingId))
            ->where('starts_at', '<', $newBlockEnd)
            ->with('service:id,duration_minutes,buffer_after_minutes')
            ->get();

        foreach ($bookings as $b) {
            $bService = $b->service;
            if ($bService === null) {
                continue;
            }
            $bDur = max(1, (int) $bService->duration_minutes);
            $bBuf = max(0, (int) $bService->buffer_after_minutes);
            $bBlockEnd = $b->starts_at->copy()->addMinutes($bDur + $bBuf);
            if ($newStart->lt($bBlockEnd) && $b->starts_at->lt($newBlockEnd)) {
                return true;
            }
        }

        return false;
    }

    private function blockedOverlap(int $shopId, int $staffId, CarbonInterface $startsAt, CarbonInterface $blockEnd): bool
    {
        $shopBlocks = SalonBlockedSlot::query()
            ->where('shop_id', $shopId)
            ->whereNull('salon_staff_id')
            ->where('starts_at', '<', $blockEnd)
            ->where('ends_at', '>', $startsAt)
            ->exists();

        if ($shopBlocks) {
            return true;
        }

        return SalonBlockedSlot::query()
            ->where('shop_id', $shopId)
            ->where('salon_staff_id', $staffId)
            ->where('starts_at', '<', $blockEnd)
            ->where('ends_at', '>', $startsAt)
            ->exists();
    }
}
