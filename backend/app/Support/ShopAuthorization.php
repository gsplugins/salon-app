<?php

namespace App\Support;

use App\Enums\ShopRole;
use App\Models\Shop;
use App\Models\User;

/**
 * Server-side role guard helpers. Use in controllers after resolving the shop context.
 * Super Admin bypass is handled by middleware or explicit checks.
 */
final class ShopAuthorization
{
    /**
     * @param  list<ShopRole|string>  $allowed  ShopRole cases or string values (owner|manager|customer)
     */
    public static function userHasShopRole(User $user, Shop $shop, array $allowed): bool
    {
        if ($user->isSuperAdmin()) {
            return true;
        }

        $allowedValues = array_map(function ($r) {
            return $r instanceof ShopRole ? $r->value : (string) $r;
        }, $allowed);

        if ((int) $shop->user_id === (int) $user->id) {
            return in_array(ShopRole::Owner->value, $allowedValues, true);
        }

        $row = $user->shopMembers()
            ->where('shop_id', $shop->id)
            ->where('is_active', true)
            ->first();

        if ($row !== null) {
            return in_array($row->role->value, $allowedValues, true);
        }

        return false;
    }
}
