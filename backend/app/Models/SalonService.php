<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalonService extends Model
{
    protected $fillable = [
        'shop_id',
        'name',
        'category',
        'duration_minutes',
        'buffer_after_minutes',
        'price_cents',
        'is_active',
        'sort_order',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function staff(): BelongsToMany
    {
        return $this->belongsToMany(SalonStaff::class, 'salon_service_staff', 'salon_service_id', 'salon_staff_id')
            ->withTimestamps();
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(SalonBooking::class, 'salon_service_id');
    }
}
