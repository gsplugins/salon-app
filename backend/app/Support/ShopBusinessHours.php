<?php

namespace App\Support;

use App\Models\Shop;
use Carbon\CarbonImmutable;

final class ShopBusinessHours
{
    /**
     * @return array{0: CarbonImmutable, 1: CarbonImmutable}|null
     */
    public static function dayOpenClose(Shop $shop, CarbonImmutable $onDate): ?array
    {
        $settings = $shop->settings ?? [];
        $hours = $settings['business_hours'] ?? null;

        $key = match ($onDate->dayOfWeekIso) {
            1 => 'mon',
            2 => 'tue',
            3 => 'wed',
            4 => 'thu',
            5 => 'fri',
            6 => 'sat',
            7 => 'sun',
            default => 'mon',
        };

        if (is_array($hours) && isset($hours[$key])) {
            $day = $hours[$key];
            if (is_array($day) && ! empty($day['closed'])) {
                return null;
            }
            if (is_array($day) && isset($day['open'], $day['close'])) {
                $dayStart = $onDate->setTimeFromTimeString((string) $day['open']);
                $dayEnd = $onDate->setTimeFromTimeString((string) $day['close']);
                if ($dayEnd->lte($dayStart)) {
                    return null;
                }

                return [$dayStart, $dayEnd];
            }
        }

        $openStr = (string) config('salon.open_time', '09:00');
        $closeStr = (string) config('salon.close_time', '18:00');
        $dayStart = $onDate->setTimeFromTimeString($openStr);
        $dayEnd = $onDate->setTimeFromTimeString($closeStr);
        if ($dayEnd->lte($dayStart)) {
            return null;
        }

        return [$dayStart, $dayEnd];
    }
}
