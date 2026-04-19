<?php

namespace App\Models;

use App\Enums\BookingSource;
use App\Enums\BookingStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalonBooking extends Model
{
    protected $table = 'salon_bookings';

    protected $fillable = [
        'shop_id',
        'customer_user_id',
        'customer_name',
        'customer_mobile',
        'salon_service_id',
        'salon_staff_id',
        'starts_at',
        'ends_at',
        'status',
        'source',
        'notes',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'status' => BookingStatus::class,
            'source' => BookingSource::class,
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function service(): BelongsTo
    {
        return $this->belongsTo(SalonService::class, 'salon_service_id');
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(SalonStaff::class, 'salon_staff_id');
    }

    public function customerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_user_id');
    }
}
