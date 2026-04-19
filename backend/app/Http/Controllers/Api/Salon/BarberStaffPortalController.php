<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\User;
use App\Support\SalonBookingPresenter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BarberStaffPortalController extends Controller
{
    public function today(Request $request): JsonResponse
    {
        $staff = $this->staff($request);
        $start = now()->startOfDay();
        $end = now()->endOfDay();

        $rows = SalonBooking::query()
            ->where('salon_staff_id', $staff->id)
            ->whereBetween('starts_at', [$start, $end])
            ->with(['service:id,name,duration_minutes', 'shop:id,name,slug'])
            ->orderBy('starts_at')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (SalonBooking $b) => SalonBookingPresenter::toArray($b))->values(),
        ]);
    }

    public function history(Request $request): JsonResponse
    {
        $staff = $this->staff($request);
        $rows = SalonBooking::query()
            ->where('salon_staff_id', $staff->id)
            ->where('starts_at', '<', now()->startOfDay())
            ->with(['service:id,name', 'shop:id,name,slug'])
            ->orderByDesc('starts_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $rows->map(fn (SalonBooking $b) => SalonBookingPresenter::toArray($b))->values(),
        ]);
    }

    private function staff(Request $request): \App\Models\SalonStaff
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $user->loadMissing('staffProfile');
        $sp = $user->staffProfile;
        if ($sp === null) {
            abort(403, 'No staff profile.');
        }

        return $sp;
    }
}
