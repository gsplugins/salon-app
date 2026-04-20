<?php

namespace App\Models;

use App\Enums\ShopRole;
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

    public function isManager(): bool
    {
        return $this->role === UserRole::Manager;
    }

    /**
     * Salon dashboard/API access: owner, manager, or stylist (not customers).
     */
    public function isBarber(): bool
    {
        return $this->role === UserRole::Barber
            || $this->role === UserRole::ShopOwner
            || $this->role === UserRole::Manager;
    }

    /**
     * Super admin or any salon staff role (owner, manager, barber).
     */
    public function hasSalonManagementAccess(): bool
    {
        return $this->isSuperAdmin() || $this->isBarber();
    }

    /**
     * Whether this user may view subscription / billing for the given shop (shop owner or platform admin).
     */
    public function canViewShopBilling(?Shop $shop): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }
        if ($shop === null) {
            return false;
        }

        return (int) $shop->user_id === (int) $this->id;
    }

    /**
     * Role label for the active management shop (owner, manager, barber, or super_admin).
     */
    public function shopAccessRoleLabel(?Shop $shop): ?string
    {
        if ($shop === null) {
            return null;
        }
        if ($this->isSuperAdmin()) {
            return 'super_admin';
        }
        if ((int) $shop->user_id === (int) $this->id) {
            return ShopRole::Owner->value;
        }
        $m = $this->shopMembers()
            ->where('shop_id', $shop->id)
            ->where('is_active', true)
            ->first();
        if ($m !== null) {
            return $m->role->value;
        }
        if ($this->role === UserRole::Barber && $this->staffProfile?->shop_id === $shop->id) {
            return 'barber';
        }

        return null;
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
     * @return HasMany<ShopMember, User>
     */
    public function shopMembers(): HasMany
    {
        return $this->hasMany(ShopMember::class);
    }

    /**
     * @return HasMany<CustomerProfile, User>
     */
    public function customerProfiles(): HasMany
    {
        return $this->hasMany(CustomerProfile::class);
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

        $membership = $this->shopMembers()
            ->where('is_active', true)
            ->whereIn('role', [ShopRole::Owner, ShopRole::Manager])
            ->orderBy('id')
            ->first();
        if ($membership !== null) {
            return $membership->shop;
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
