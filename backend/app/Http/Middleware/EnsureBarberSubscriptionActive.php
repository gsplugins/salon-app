<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureBarberSubscriptionActive
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

        $shop = $user->primaryShop();
        if ($shop === null) {
            return response()->json(['message' => 'No shop.'], 403);
        }

        $sub = $shop->subscription;
        if ($sub === null || ! $sub->allowsAppAccess()) {
            return response()->json([
                'message' => 'Subscription is not active. Please renew to manage your shop.',
            ], 402);
        }

        return $next($request);
    }
}
