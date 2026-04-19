<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalonQueueEntry;
use App\Models\Shop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PublicShopQueueController extends Controller
{
    public function index(int $shopId): JsonResponse
    {
        $shop = Shop::query()->publiclyBookable()->whereKey($shopId)->firstOrFail();

        $rows = SalonQueueEntry::query()
            ->where('shop_id', $shop->id)
            ->whereIn('status', ['waiting', 'in_progress'])
            ->with(['staff:id,name'])
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (SalonQueueEntry $q) => [
                'id' => $q->id,
                'position' => $q->position,
                'status' => $q->status,
                'customer_name' => $q->customer_name,
                'estimated_wait_minutes' => $q->estimated_wait_minutes,
                'staff' => $q->staff ? ['id' => $q->staff->id, 'name' => $q->staff->name] : null,
                'join_time' => $q->join_time?->toIso8601String(),
            ]),
        ]);
    }

    public function join(Request $request, int $shopId): JsonResponse
    {
        $shop = Shop::query()->publiclyBookable()->whereKey($shopId)->firstOrFail();

        $data = $request->validate([
            'customer_name' => ['required', 'string', 'max:255'],
            'customer_mobile' => ['nullable', 'string', 'max:32'],
        ]);

        $row = DB::transaction(function () use ($shop, $data, $request) {
            $max = (int) SalonQueueEntry::query()
                ->where('shop_id', $shop->id)
                ->whereIn('status', ['waiting', 'in_progress'])
                ->max('position');

            $uid = $request->user()?->id;

            return SalonQueueEntry::query()->create([
                'shop_id' => $shop->id,
                'customer_user_id' => $uid,
                'customer_name' => $data['customer_name'],
                'customer_mobile' => $data['customer_mobile'] ?? null,
                'position' => $max + 1,
                'status' => 'waiting',
                'estimated_wait_minutes' => $max + 1 <= 1 ? 10 : ($max + 1) * 15,
            ]);
        });

        return response()->json(['data' => ['id' => $row->id, 'position' => $row->position]], 201);
    }
}
