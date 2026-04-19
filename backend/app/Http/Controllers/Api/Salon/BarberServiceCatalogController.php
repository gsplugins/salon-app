<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Controller;
use App\Models\SalonService;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BarberServiceCatalogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $this->shop($request);

        $rows = $shop->services()
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $rows->map(fn (SalonService $s) => $this->row($s))]);
    }

    public function store(Request $request): JsonResponse
    {
        $shop = $this->shop($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
            'duration_minutes' => ['required', 'integer', 'min:5', 'max:480'],
            'buffer_after_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'price_cents' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ]);

        $service = $shop->services()->create([
            'name' => $data['name'],
            'category' => $data['category'] ?? null,
            'duration_minutes' => $data['duration_minutes'],
            'buffer_after_minutes' => $data['buffer_after_minutes'] ?? 0,
            'price_cents' => $data['price_cents'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        return response()->json(['data' => $this->row($service)], 201);
    }

    public function update(Request $request, int $serviceId): JsonResponse
    {
        $shop = $this->shop($request);

        $service = SalonService::query()
            ->where('shop_id', $shop->id)
            ->whereKey($serviceId)
            ->firstOrFail();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:64'],
            'duration_minutes' => ['sometimes', 'integer', 'min:5', 'max:480'],
            'buffer_after_minutes' => ['nullable', 'integer', 'min:0', 'max:120'],
            'price_cents' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:65535'],
        ]);

        $service->fill($data);
        $service->save();

        return response()->json(['data' => $this->row($service->fresh())]);
    }

    public function destroy(Request $request, int $serviceId): JsonResponse
    {
        $shop = $this->shop($request);

        $service = SalonService::query()
            ->where('shop_id', $shop->id)
            ->whereKey($serviceId)
            ->firstOrFail();

        if ($service->bookings()->exists()) {
            $service->update(['is_active' => false]);

            return response()->json(['message' => 'Service has bookings; it was deactivated instead of deleted.', 'data' => $this->row($service->fresh())]);
        }

        $service->staff()->detach();
        $service->delete();

        return response()->json(['message' => 'Service removed.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function row(SalonService $s): array
    {
        return [
            'id' => $s->id,
            'name' => $s->name,
            'category' => $s->category,
            'duration_minutes' => $s->duration_minutes,
            'buffer_after_minutes' => $s->buffer_after_minutes,
            'price_cents' => $s->price_cents,
            'is_active' => $s->is_active,
            'sort_order' => $s->sort_order,
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
