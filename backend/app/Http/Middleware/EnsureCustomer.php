<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureCustomer
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user instanceof User || $user->role !== UserRole::Customer) {
            return response()->json([
                'message' => 'This endpoint is for customer accounts only. Shop staff should use salon management APIs.',
            ], 403);
        }

        return $next($request);
    }
}
