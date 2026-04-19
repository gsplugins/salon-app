<?php

namespace App\Models;

use App\Enums\UserRole;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'mobile',
        'password',
        'is_admin',
        'role',
        'is_locked',
        'loyalty_points',
        'google_id',
    ];

    /**
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'is_locked' => 'boolean',
            'loyalty_points' => 'integer',
            'role' => UserRole::class,
        ];
    }

    public function isSuperAdmin(): bool
    {
        return $this->role === UserRole::SuperAdmin;
    }

    public function isShopOwner(): bool
    {
        return $this->role === UserRole::ShopOwner;
    }

    /**
     * Shop dashboard access: owner or legacy role name, or staff barber.
     */
    public function isBarber(): bool
    {
        return $this->role === UserRole::Barber
            || $this->role === UserRole::ShopOwner;
    }

    /**
     * Shops owned by this user (multi-location).
     *
     * @return HasMany<Shop, User>
     */
    public function shops(): HasMany
    {
        return $this->hasMany(Shop::class, 'user_id');
    }

    /**
     * Primary shop for API compatibility (oldest id), or staff member's workplace.
     */
    public function primaryShop(): ?Shop
    {
        $owned = $this->shops()->orderBy('id')->first();
        if ($owned !== null) {
            return $owned;
        }

        $this->loadMissing('staffProfile.shop');

        return $this->staffProfile?->shop;
    }

    /**
     * Shop context for `/my/shop/*` management APIs. Same as {@see primaryShop()} for owners and staff.
     * Super admins without an owned shop may use the first shop in the database for platform oversight.
     */
    public function managementShop(): ?Shop
    {
        $primary = $this->primaryShop();
        if ($primary !== null) {
            return $primary;
        }

        if ($this->isSuperAdmin()) {
            return Shop::query()->orderBy('id')->first();
        }

        return null;
    }

    /**
     * Barber/stylist profile when this user is staff (not the shop owner).
     */
    public function staffProfile(): HasOne
    {
        return $this->hasOne(SalonStaff::class, 'user_id');
    }

    public function refreshTokens(): HasMany
    {
        return $this->hasMany(RefreshToken::class);
    }

    /**
     * @return HasMany<LoyaltyTransaction, User>
     */
    public function loyaltyTransactions(): HasMany
    {
        return $this->hasMany(LoyaltyTransaction::class);
    }
}
