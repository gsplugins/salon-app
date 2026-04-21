<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Shop billing / ownership actions: only the record owner (shops.user_id) or super admin.
 */
class EnsureShopOwner
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if ($user->isSuperAdmin()) {
            return $next($request);
        }

        $shop = $user->resolveManagementShop($request);
        if ($shop === null) {
            return response()->json(['message' => 'No shop linked to this account.'], 403);
        }

        if ((int) $shop->user_id !== (int) $user->id) {
            return response()->json([
                'message' => 'Only the shop owner can perform this action.',
            ], 403);
        }

        return $next($request);
    }
}
