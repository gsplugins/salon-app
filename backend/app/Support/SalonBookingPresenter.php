<?php

namespace App\Support;

use App\Models\SalonBooking;

final class SalonBookingPresenter
{
    /**
     * @return array<string, mixed>
     */
    public static function toArray(SalonBooking $booking): array
    {
        $booking->loadMissing([
            'service:id,name,category,duration_minutes,price_cents',
            'staff:id,name',
            'shop:id,name,slug',
        ]);

        $shopPayload = null;
        if ($booking->shop !== null) {
            $shopPayload = [
                'id' => $booking->shop->id,
                'name' => $booking->shop->name,
                'slug' => $booking->shop->slug,
            ];
        }

        return [
            'id' => $booking->id,
            'customer_name' => $booking->customer_name,
            'customer_mobile' => $booking->customer_mobile,
            'shop' => $shopPayload,
            'service' => [
                'id' => $booking->service->id,
                'name' => $booking->service->name,
                'category' => $booking->service->category,
                'duration_minutes' => $booking->service->duration_minutes,
                'price_cents' => $booking->service->price_cents,
            ],
            'staff' => [
                'id' => $booking->staff->id,
                'name' => $booking->staff->name,
            ],
            'starts_at' => $booking->starts_at->toIso8601String(),
            'ends_at' => $booking->ends_at->toIso8601String(),
            'status' => $booking->status->value,
            'source' => $booking->source->value,
            'notes' => $booking->notes,
        ];
    }
}
