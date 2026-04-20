<?php

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureBarber
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

        if (! $user->hasSalonManagementAccess()) {
            return response()->json([
                'message' => 'Salon management access only. Use a shop owner, manager, or salon staff account.',
            ], 403);
        }

        if ($user->primaryShop() === null) {
            return response()->json(['message' => 'No shop linked to this account.'], 403);
        }

        return $next($request);
    }
}
