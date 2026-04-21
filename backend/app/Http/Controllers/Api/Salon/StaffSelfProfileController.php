<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Api\Staff\ResolvesStaffProfile;
use App\Http\Controllers\Controller;
use App\Models\SalonStaff;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Line staff (barber role + salon_staff row): edit own profile fields only.
 */
class StaffSelfProfileController extends Controller
{
    use ResolvesStaffProfile;

    public function show(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $staff->loadMissing(['user:id,name,mobile,email', 'shop:id,name,slug']);

        return response()->json(['data' => $this->row($staff)]);
    }

    public function update(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['nullable', 'string', 'email', 'max:255'],
            'bio' => ['nullable', 'string', 'max:5000'],
            'specialties' => ['nullable', 'array'],
            'specialties.*' => ['string', 'max:128'],
            'photo_url' => ['nullable', 'string', 'max:2048'],
            'address' => ['nullable', 'string', 'max:2000'],
            'age' => ['nullable', 'integer', 'min:16', 'max:120'],
            'experience_years' => ['nullable', 'integer', 'min:0', 'max:80'],
            'work_mobile' => ['nullable', 'string', 'max:32'],
            'position_title' => ['nullable', 'string', 'max:128'],
            'emergency_contact_name' => ['nullable', 'string', 'max:128'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:32'],
        ]);

        foreach (array_keys($data) as $key) {
            if ($key === 'email') {
                continue;
            }
            if ($key === 'specialties' && array_key_exists('specialties', $data)) {
                $staff->specialties = $data['specialties'];
            } elseif (array_key_exists($key, $data)) {
                $staff->{$key} = $data[$key];
            }
        }
        $staff->save();

        if ($staff->user_id !== null) {
            $userUpdates = [];
            if (isset($data['name'])) {
                $userUpdates['name'] = $data['name'];
            }
            if (array_key_exists('email', $data)) {
                $userUpdates['email'] = $data['email'];
            }
            if ($userUpdates !== []) {
                User::query()->whereKey($staff->user_id)->update($userUpdates);
            }
        }

        $staff->loadMissing(['user:id,name,mobile,email', 'shop:id,name,slug']);

        return response()->json(['data' => $this->row($staff->fresh())]);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(SalonStaff $s): array
    {
        $u = $s->user;

        $shop = $s->relationLoaded('shop') ? $s->shop : null;

        return [
            'id' => $s->id,
            'shop_id' => $s->shop_id,
            'user_id' => $s->user_id,
            'name' => $s->name,
            'position_title' => $s->position_title,
            'staff_role' => $s->staff_role,
            'bio' => $s->bio,
            'specialties' => $s->specialties ?? [],
            'photo_url' => $s->photo_url,
            'address' => $s->address,
            'age' => $s->age,
            'experience_years' => $s->experience_years,
            'work_mobile' => $s->work_mobile,
            'emergency_contact_name' => $s->emergency_contact_name,
            'emergency_contact_phone' => $s->emergency_contact_phone,
            'is_active' => $s->is_active,
            'commission_percent' => $s->commission_percent,
            'availability_status' => $s->availability_status ?? 'available',
            'portal_settings' => $s->portal_settings ?? (object) [],
            'login_mobile' => $u?->mobile,
            'email' => $u?->email,
            'shop' => $shop ? [
                'id' => $shop->id,
                'name' => $shop->name,
                'slug' => $shop->slug,
            ] : null,
            'can_manage_team' => false,
        ];
    }
}
