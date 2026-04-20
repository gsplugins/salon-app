<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Per-shop customer identity (one user may have many profiles — one per shop).
 */
class CustomerProfile extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'shop_id',
        'display_name',
        'email',
        'email_verified_at',
        'phone',
        'avatar_url',
        'date_of_birth',
        'gender',
        'preferred_language',
        'default_address',
        'notification_preferences',
        'wishlist',
        'loyalty_points',
        'wallet_balance_cents',
        'last_active_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'date_of_birth' => 'date',
            'default_address' => 'array',
            'notification_preferences' => 'array',
            'wishlist' => 'array',
            'loyalty_points' => 'integer',
            'wallet_balance_cents' => 'integer',
            'last_active_at' => 'datetime',
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
}
