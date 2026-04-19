<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalonPayment extends Model
{
    protected $table = 'salon_payments';

    protected $fillable = [
        'shop_id',
        'salon_booking_id',
        'method',
        'amount_cents',
        'currency',
        'transaction_id',
        'status',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
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
