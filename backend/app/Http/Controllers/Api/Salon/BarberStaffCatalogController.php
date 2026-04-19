<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Controller;
use App\Models\SalonStaff;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class BarberStaffCatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $this->shop($request);

        $rows = $shop->staff()
            ->with(['services:id,name'])
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (SalonStaff $s) => $this->row($s)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $shop = $this->shop($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', Rule::exists('salon_services', 'id')->where('shop_id', $shop->id)],
        ]);

        $staff = $shop->staff()->create([
            'name' => $data['name'],
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        if (! empty($data['service_ids'])) {
            $staff->services()->sync($data['service_ids']);
        }

        $staff->load('services:id,name');

        return response()->json(['data' => $this->row($staff)], 201);
    }

    public function update(Request $request, int $staffId): JsonResponse
    {
        $shop = $this->shop($request);

        $staff = SalonStaff::query()
            ->where('shop_id', $shop->id)
            ->whereKey($staffId)
            ->firstOrFail();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
            'service_ids' => ['nullable', 'array'],
            'service_ids.*' => ['integer', Rule::exists('salon_services', 'id')->where('shop_id', $shop->id)],
        ]);

        if (isset($data['name'])) {
            $staff->name = $data['name'];
        }
        if (isset($data['is_active'])) {
            $staff->is_active = $data['is_active'];
        }
        if (array_key_exists('sort_order', $data)) {
            $staff->sort_order = $data['sort_order'];
        }
        $staff->save();

        if (array_key_exists('service_ids', $data) && is_array($data['service_ids'])) {
            $staff->services()->sync($data['service_ids']);
        }

        $staff->load('services:id,name');

        return response()->json(['data' => $this->row($staff->fresh())]);
    }

    public function destroy(Request $request, int $staffId): JsonResponse
    {
        $shop = $this->shop($request);

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
            'name' => $s->name,
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
}
