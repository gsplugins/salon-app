<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Controller;
use App\Models\SalonReview;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerReviewController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $rows = SalonReview::query()
            ->where('shop_id', $shop->id)
            ->with(['staff:id,name', 'customer:id,name'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json(['data' => $rows]);
    }

    public function updateReply(Request $request, int $reviewId): JsonResponse
    {
        $shop = $this->shop($request);
        $review = SalonReview::query()
            ->where('shop_id', $shop->id)
            ->whereKey($reviewId)
            ->firstOrFail();

        $data = $request->validate([
            'owner_reply' => ['required', 'string', 'max:5000'],
        ]);

        $review->owner_reply = $data['owner_reply'];
        $review->save();

        return response()->json(['data' => $review->fresh()]);
    }

    private function shop(Request $request): Shop
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
