<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Controller;
use App\Models\SalonQueueEntry;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerQueueController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $rows = SalonQueueEntry::query()
            ->where('shop_id', $shop->id)
            ->with(['staff:id,name', 'customer:id,name'])
            ->orderBy('position')
            ->orderBy('id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function updateStatus(Request $request, int $id): JsonResponse
    {
        $shop = $this->shop($request);
        $row = SalonQueueEntry::query()
            ->where('shop_id', $shop->id)
            ->whereKey($id)
            ->firstOrFail();

        $data = $request->validate([
            'status' => ['required', 'string', 'in:waiting,in_progress,done,cancelled'],
        ]);

        $row->status = $data['status'];
        $row->save();

        return response()->json(['data' => $row->fresh()]);
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
