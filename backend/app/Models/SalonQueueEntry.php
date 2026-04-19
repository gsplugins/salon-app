<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalonQueueEntry extends Model
{
    protected $table = 'salon_queue_entries';

    protected $fillable = [
        'shop_id',
        'salon_staff_id',
        'customer_user_id',
        'customer_name',
        'customer_mobile',
        'position',
        'estimated_wait_minutes',
        'status',
        'join_time',
    ];

    protected function casts(): array
    {
        return [
            'join_time' => 'datetime',
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

    public function customer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'customer_user_id');
    }
}
