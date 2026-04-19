<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureStaffBarber
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->loadMissing('staffProfile');

        if ($user->role !== UserRole::Barber || $user->staffProfile === null) {
            return response()->json(['message' => 'Forbidden. Barber staff profile required.'], 403);
        }

        return $next($request);
    }
}
