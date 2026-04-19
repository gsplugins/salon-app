<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalonReview extends Model
{
    protected $table = 'salon_reviews';

    protected $fillable = [
        'shop_id',
        'salon_staff_id',
        'salon_booking_id',
        'customer_user_id',
        'rating',
        'comment',
        'owner_reply',
        'flagged_at',
    ];

    protected function casts(): array
    {
        return [
            'flagged_at' => 'datetime',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(SalonStaff::class, 'salon_staff_id');
    }

    public function booking(): BelongsTo
    {
        return $this->belongsTo(SalonBooking::class, 'salon_booking_id');
    }

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_user_id');
    }
}
