<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Shop extends Model
{
    protected $fillable = [
        'user_id',
        'parent_shop_id',
        'name',
        'slug',
        'description',
        'phone',
        'email',
        'address',
        'latitude',
        'longitude',
        'photos',
        'is_active',
        'settings',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
            'settings' => 'array',
            'photos' => 'array',
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
        ];
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(Shop::class, 'parent_shop_id');
    }

    public function branches(): HasMany
    {
        return $this->hasMany(Shop::class, 'parent_shop_id');
    }

    public function getRouteKeyName(): string
    {
        return 'slug';
    }

    /**
     * Public routes: only active shops with a subscription that allows bookings.
     */
    public function resolveRouteBinding($value, $field = null)
    {
        $shop = static::query()
            ->where($field ?? 'slug', $value)
            ->with('subscription')
            ->firstOrFail();

        if (! $shop->is_active) {
            abort(404);
        }

        $sub = $shop->subscription;
        if ($sub === null || ! $sub->allowsAppAccess()) {
            abort(403, 'This shop is not accepting bookings right now.');
        }

        return $shop;
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function subscription(): HasOne
    {
        return $this->hasOne(Subscription::class);
    }

    public function services(): HasMany
    {
        return $this->hasMany(SalonService::class, 'shop_id');
    }

    public function staff(): HasMany
    {
        return $this->hasMany(SalonStaff::class, 'shop_id');
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(SalonReview::class, 'shop_id');
    }

    /**
     * Shops that appear in the public directory (active + paying subscription).
     *
     * @param  Builder<Shop>  $query
     * @return Builder<Shop>
     */
    public function scopePubliclyBookable(Builder $query): Builder
    {
        return $query->where('is_active', true)
            ->whereHas('subscription', function ($q) {
                $q->whereIn('status', [
                    SubscriptionStatus::Trialing->value,
                    SubscriptionStatus::Active->value,
                ]);
            });
    }
}
