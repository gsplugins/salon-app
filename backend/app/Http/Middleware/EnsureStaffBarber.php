<?php

namespace App\Http\Middleware;

use App\Enums\UserRole;
use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Staff portal APIs: stylists use their linked {@see SalonStaff} row; shop owners, managers, and
 * super admins must send {@see \App\Support\SalonManagementContext::ACT_AS_STAFF_ID_HEADER} to pick a team member.
 */
class EnsureStaffBarber
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        if (! $user->hasSalonManagementAccess()) {
            return response()->json(['message' => 'Forbidden. Salon management or staff access required.'], 403);
        }

        if ($user->role === UserRole::Barber) {
            $user->loadMissing('staffProfile');
            if ($user->staffProfile === null) {
                return response()->json(['message' => 'Forbidden. Barber staff profile required.'], 403);
            }
        }

        return $next($request);
    }
}
