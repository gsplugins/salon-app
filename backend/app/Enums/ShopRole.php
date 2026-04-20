<?php

namespace App\Enums;

/**
 * Per-shop role (see shop_members). Separate from {@see UserRole} which is account-level.
 * Hierarchy: Owner > Manager > Customer (within a shop).
 */
enum ShopRole: string
{
    case Owner = 'owner';
    case Manager = 'manager';
    /** End-customer shopping at this shop (loyalty, profile). */
    case Customer = 'customer';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $c) => $c->value, self::cases());
    }
}
