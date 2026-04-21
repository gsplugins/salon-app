<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Controller;
use App\Models\InventoryItem;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerInventoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $this->shop($request);

        return response()->json([
            'data' => InventoryItem::query()->where('shop_id', $shop->id)->orderBy('name')->get(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'quantity' => ['required', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:32'],
            'low_stock_threshold' => ['nullable', 'numeric', 'min:0'],
        ]);

        $row = InventoryItem::query()->create([
            'shop_id' => $shop->id,
            'name' => $data['name'],
            'quantity' => $data['quantity'],
            'unit' => $data['unit'] ?? 'unit',
            'low_stock_threshold' => $data['low_stock_threshold'] ?? null,
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $shop = $this->shop($request);
        $row = InventoryItem::query()->where('shop_id', $shop->id)->whereKey($id)->firstOrFail();
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'quantity' => ['sometimes', 'numeric', 'min:0'],
            'unit' => ['nullable', 'string', 'max:32'],
            'low_stock_threshold' => ['nullable', 'numeric', 'min:0'],
        ]);
        $row->fill($data);
        $row->save();

        return response()->json(['data' => $row->fresh()]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $shop = $this->shop($request);
        InventoryItem::query()->where('shop_id', $shop->id)->whereKey($id)->delete();

        return response()->json(['message' => 'Deleted.']);
    }

    private function shop(Request $request): Shop
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $shop = $user->resolveManagementShop($request);
        if ($shop === null) {
            abort(403, 'No shop.');
        }

        return $shop;
    }
}
