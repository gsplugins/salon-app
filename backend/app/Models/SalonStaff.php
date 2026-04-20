<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SalonStaff extends Model
{
    protected $table = 'salon_staff';

    protected $fillable = [
        'shop_id',
        'user_id',
        'name',
        'position_title',
        'staff_role',
        'bio',
        'specialties',
        'photo_url',
        'address',
        'age',
        'experience_years',
        'work_mobile',
        'emergency_contact_name',
        'emergency_contact_phone',
        'weekly_schedule',
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
            'specialties' => 'array',
            'weekly_schedule' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function services(): BelongsToMany
    {
        return $this->belongsToMany(SalonService::class, 'salon_service_staff', 'salon_staff_id', 'salon_service_id')
            ->withTimestamps();
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(SalonBooking::class, 'salon_staff_id');
    }

    public function blockedSlots(): HasMany
    {
        return $this->hasMany(SalonBlockedSlot::class, 'salon_staff_id');
    }
}
