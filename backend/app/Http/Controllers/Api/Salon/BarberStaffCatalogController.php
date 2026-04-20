<?php

namespace App\Http\Controllers\Api\Salon;

use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\SalonStaff;
use App\Models\User;
use App\Support\MobileNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;

class BarberStaffCatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $actor = $this->userOrAbort($request);

        $rowsQ = $shop->staff()
            ->with(['services:id,name', 'user:id,mobile'])
            ->orderBy('sort_order');
        if ($actor->role === UserRole::Barber && $actor->staffProfile?->id !== null) {
            $rowsQ->whereKey($actor->staffProfile->id);
        } else {
            $rowsQ->orderBy('name');
        }
        $rows = $rowsQ->get();

        return response()->json([
            'data' => $rows->map(fn (SalonStaff $s) => $this->row($s)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $this->assertCanManageTeam($request);
        $this->assertStaffLimit($shop);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'position_title' => ['nullable', 'string', 'max:128'],
            'staff_role' => ['nullable', 'string', Rule::in(['owner', 'manager', 'senior_stylist', 'stylist', 'junior', 'assistant', 'reception'])],
            'bio' => ['nullable', 'string', 'max:5000'],
            'address' => ['nullable', 'string', 'max:2000'],
            'age' => ['nullable', 'integer', 'min:16', 'max:120'],
            'experience_years' => ['nullable', 'integer', 'min:0', 'max:80'],
            'work_mobile' => ['nullable', 'string', 'max:32'],
            'emergency_contact_name' => ['nullable', 'string', 'max:128'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:32'],
            'specialties' => ['nullable', 'array'],
            'specialties.*' => ['string', 'max:128'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', Rule::exists('salon_services', 'id')->where('shop_id', $shop->id)],
        ]);

        $staff = $shop->staff()->create([
            'name' => $data['name'],
            'position_title' => $data['position_title'] ?? null,
            'staff_role' => $data['staff_role'] ?? null,
            'bio' => $data['bio'] ?? null,
            'address' => $data['address'] ?? null,
            'age' => $data['age'] ?? null,
            'experience_years' => $data['experience_years'] ?? null,
            'work_mobile' => $data['work_mobile'] ?? null,
            'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
            'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
            'specialties' => $data['specialties'] ?? [],
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        if (! empty($data['service_ids'])) {
            $staff->services()->sync($data['service_ids']);
        }

        $staff->load(['services:id,name', 'user:id,mobile']);

        return response()->json(['data' => $this->row($staff)], 201);
    }

    /**
     * Shop owner only (route): create a stylist user account + staff row so they can log in as barber.
     */
    public function storeWithAccount(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $this->assertStaffLimit($shop);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'mobile' => ['required', 'string', 'min:8', 'max:32'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'position_title' => ['nullable', 'string', 'max:128'],
            'staff_role' => ['nullable', 'string', Rule::in(['owner', 'manager', 'senior_stylist', 'stylist', 'junior', 'assistant', 'reception'])],
            'bio' => ['nullable', 'string', 'max:5000'],
            'address' => ['nullable', 'string', 'max:2000'],
            'age' => ['nullable', 'integer', 'min:16', 'max:120'],
            'experience_years' => ['nullable', 'integer', 'min:0', 'max:80'],
            'work_mobile' => ['nullable', 'string', 'max:32'],
            'emergency_contact_name' => ['nullable', 'string', 'max:128'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:32'],
            'specialties' => ['nullable', 'array'],
            'specialties.*' => ['string', 'max:128'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', Rule::exists('salon_services', 'id')->where('shop_id', $shop->id)],
        ]);

        $mobile = MobileNormalizer::normalize($data['mobile']);
        if ($mobile === '') {
            throw ValidationException::withMessages([
                'mobile' => ['Invalid mobile number.'],
            ]);
        }

        if (User::query()->where('mobile', $mobile)->exists()) {
            throw ValidationException::withMessages([
                'mobile' => ['This mobile number is already registered.'],
            ]);
        }

        $staff = DB::transaction(function () use ($shop, $data, $mobile) {
            $user = User::query()->create([
                'name' => $data['name'],
                'email' => null,
                'mobile' => $mobile,
                'password' => $data['password'],
                'is_admin' => false,
                'role' => UserRole::Barber,
            ]);

            $row = $shop->staff()->create([
                'user_id' => $user->id,
                'name' => $data['name'],
                'position_title' => $data['position_title'] ?? null,
                'staff_role' => $data['staff_role'] ?? null,
                'bio' => $data['bio'] ?? null,
                'address' => $data['address'] ?? null,
                'age' => $data['age'] ?? null,
                'experience_years' => $data['experience_years'] ?? null,
                'work_mobile' => $data['work_mobile'] ?? null,
                'emergency_contact_name' => $data['emergency_contact_name'] ?? null,
                'emergency_contact_phone' => $data['emergency_contact_phone'] ?? null,
                'specialties' => $data['specialties'] ?? [],
                'is_active' => $data['is_active'] ?? true,
                'sort_order' => $data['sort_order'] ?? 0,
            ]);

            if (! empty($data['service_ids'])) {
                $row->services()->sync($data['service_ids']);
            }

            $row->load(['services:id,name', 'user:id,mobile']);

            return $row;
        });

        return response()->json(['data' => $this->row($staff)], 201);
    }

    public function update(Request $request, int $staffId): JsonResponse
    {
        $shop = $this->shop($request);
        $this->assertCanManageTeam($request);

        $staff = SalonStaff::query()
            ->where('shop_id', $shop->id)
            ->whereKey($staffId)
            ->firstOrFail();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'position_title' => ['sometimes', 'nullable', 'string', 'max:128'],
            'staff_role' => ['sometimes', 'nullable', 'string', Rule::in(['owner', 'manager', 'senior_stylist', 'stylist', 'junior', 'assistant', 'reception'])],
            'bio' => ['sometimes', 'nullable', 'string', 'max:5000'],
            'address' => ['sometimes', 'nullable', 'string', 'max:2000'],
            'age' => ['sometimes', 'nullable', 'integer', 'min:16', 'max:120'],
            'experience_years' => ['sometimes', 'nullable', 'integer', 'min:0', 'max:80'],
            'work_mobile' => ['sometimes', 'nullable', 'string', 'max:32'],
            'emergency_contact_name' => ['sometimes', 'nullable', 'string', 'max:128'],
            'emergency_contact_phone' => ['sometimes', 'nullable', 'string', 'max:32'],
            'specialties' => ['sometimes', 'nullable', 'array'],
            'specialties.*' => ['string', 'max:128'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'mobile' => ['sometimes', 'string', 'min:8', 'max:32'],
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', Rule::exists('salon_services', 'id')->where('shop_id', $shop->id)],
        ]);

        if (isset($data['name'])) {
            $staff->name = $data['name'];
        }
        foreach ([
            'position_title',
            'staff_role',
            'bio',
            'address',
            'age',
            'experience_years',
            'work_mobile',
            'emergency_contact_name',
            'emergency_contact_phone',
        ] as $field) {
            if (array_key_exists($field, $data)) {
                $staff->{$field} = $data[$field];
            }
        }
        if (array_key_exists('specialties', $data)) {
            $staff->specialties = $data['specialties'] ?? [];
        }
        if (isset($data['is_active'])) {
            $staff->is_active = $data['is_active'];
        }
        if (array_key_exists('sort_order', $data)) {
            $staff->sort_order = $data['sort_order'];
        }
        $staff->save();

        if (($staff->user_id === null) && (isset($data['mobile']) || isset($data['password']))) {
            throw ValidationException::withMessages([
                'mobile' => ['This staff member has no login account yet. Use "Create with account" first.'],
            ]);
        }

        if ($staff->user_id !== null) {
            /** @var User|null $user */
            $user = User::query()->whereKey($staff->user_id)->first();
            if ($user !== null) {
                if (isset($data['name'])) {
                    $user->name = $data['name'];
                }
                if (isset($data['mobile'])) {
                    $mobile = MobileNormalizer::normalize($data['mobile']);
                    if ($mobile === '') {
                        throw ValidationException::withMessages(['mobile' => ['Invalid mobile number.']]);
                    }
                    $exists = User::query()
                        ->where('mobile', $mobile)
                        ->whereKeyNot($user->id)
                        ->exists();
                    if ($exists) {
                        throw ValidationException::withMessages(['mobile' => ['This mobile number is already registered.']]);
                    }
                    $user->mobile = $mobile;
                }
                if (isset($data['password'])) {
                    $user->password = Hash::make($data['password']);
                }
                $user->save();
            }
        }

        if (array_key_exists('service_ids', $data) && is_array($data['service_ids'])) {
            $staff->services()->sync($data['service_ids']);
        }

        $staff->load(['services:id,name', 'user:id,mobile']);

        return response()->json(['data' => $this->row($staff->fresh())]);
    }

    public function destroy(Request $request, int $staffId): JsonResponse
    {
        $shop = $this->shop($request);
        $this->assertCanManageTeam($request);

        $staff = SalonStaff::query()
            ->where('shop_id', $shop->id)
            ->whereKey($staffId)
            ->firstOrFail();

        if ($staff->bookings()->exists()) {
            $staff->update(['is_active' => false]);

            return response()->json(['message' => 'Staff member has bookings; deactivated instead of deleted.', 'data' => $this->row($staff->fresh())]);
        }

        $staff->services()->detach();
        $staff->delete();

        return response()->json(['message' => 'Team member removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(SalonStaff $s): array
    {
        return [
            'id' => $s->id,
            'user_id' => $s->user_id,
            'has_staff_login' => $s->user_id !== null,
            'name' => $s->name,
            'position_title' => $s->position_title,
            'staff_role' => $s->staff_role,
            'bio' => $s->bio,
            'specialties' => $s->specialties ?? [],
            'address' => $s->address,
            'age' => $s->age,
            'experience_years' => $s->experience_years,
            'work_mobile' => $s->work_mobile,
            'emergency_contact_name' => $s->emergency_contact_name,
            'emergency_contact_phone' => $s->emergency_contact_phone,
            'login_mobile' => $s->user?->mobile,
            'is_active' => $s->is_active,
            'sort_order' => $s->sort_order,
            'services' => $s->relationLoaded('services')
                ? $s->services->map(fn ($svc) => ['id' => $svc->id, 'name' => $svc->name])->values()
                : [],
        ];
    }

    private function shop(Request $request): \App\Models\Shop
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $shop = $user->managementShop();
        if ($shop === null) {
            abort(403, 'No shop.');
        }

        return $shop;
    }

    private function userOrAbort(Request $request): User
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $user->loadMissing('staffProfile');

        return $user;
    }

    private function assertCanManageTeam(Request $request): void
    {
        $user = $this->userOrAbort($request);
        if ($user->isSuperAdmin() || $user->isShopOwner() || $user->isManager()) {
            return;
        }
        throw new HttpException(403, 'Only owner or manager can manage staff.');
    }

    private function assertStaffLimit(\App\Models\Shop $shop): void
    {
        $settings = is_array($shop->settings) ? $shop->settings : [];
        $limit = (int) ($settings['staff_limit'] ?? 30);
        if ($limit < 1) {
            $limit = 1;
        }
        $count = \App\Models\SalonStaff::query()
            ->where('shop_id', $shop->id)
            ->count();
        if ($count >= $limit) {
            throw ValidationException::withMessages([
                'name' => ["Staff limit reached ({$limit}). Ask super admin to increase the shop staff limit."],
            ]);
        }
    }
}
