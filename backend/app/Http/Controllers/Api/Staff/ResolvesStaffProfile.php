<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\UserRole;
use App\Models\SalonStaff;
use App\Models\User;
use App\Support\SalonManagementContext;
use Illuminate\Http\Request;

trait ResolvesStaffProfile
{
    protected function staffFromRequest(Request $request): SalonStaff
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        if ($user->role === UserRole::Barber) {
            $user->loadMissing('staffProfile.shop');
            $sp = $user->staffProfile;
            if ($sp === null) {
                abort(403, 'No staff profile.');
            }

            return $sp;
        }

        $raw = $request->headers->get(SalonManagementContext::ACT_AS_STAFF_ID_HEADER);
        $staffId = is_numeric($raw) ? (int) $raw : 0;
        if ($staffId <= 0) {
            abort(422, 'Missing or invalid '.SalonManagementContext::ACT_AS_STAFF_ID_HEADER.' header. Pick a team member to use the staff portal.');
        }

        $shop = $user->resolveManagementShop($request);
        if ($shop === null) {
            abort(403, 'No shop context. Use a shop-linked account or send '.SalonManagementContext::ACT_AS_SHOP_SLUG_HEADER.'.');
        }

        $staff = SalonStaff::query()->with('shop')->whereKey($staffId)->where('shop_id', $shop->id)->first();
        if ($staff === null) {
            abort(403, 'Staff member not found in this shop.');
        }

        return $staff;
    }
}
