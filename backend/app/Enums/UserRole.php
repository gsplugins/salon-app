<?php

namespace App\Enums;

enum UserRole: string
{
    case SuperAdmin = 'super_admin';
    /** Owns one or more shops (dashboard, billing). */
    case ShopOwner = 'shop_owner';
    /**
     * Operational manager for a shop (see shop_members). No billing/ownership by default.
     */
    case Manager = 'manager';
    /** Barber/stylist account linked to {@see \App\Models\SalonStaff} (schedule, queue). */
    case Barber = 'barber';
    case Customer = 'customer';

    /**
     * @return list<string>
     */
    public static function values(): array
    {
        return array_map(fn (self $c) => $c->value, self::cases());
    }
}
