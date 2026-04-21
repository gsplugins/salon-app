<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StaffCommissionItem extends Model
{
    protected $fillable = [
        'salon_staff_id',
        'shop_id',
        'salon_booking_id',
        'amount_cents',
        'status',
        'paid_at',
    ];

    protected function casts(): array
    {
        return [
            'paid_at' => 'datetime',
        ];
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(SalonStaff::class, 'salon_staff_id');
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(SalonBooking::class, 'salon_booking_id');
    }
}
