<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalonReview;
use App\Models\SalonService;
use App\Models\SalonStaff;
use App\Models\Shop;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicShopDirectoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Shop::query()
            ->publiclyBookable()
            ->with('subscription:id,shop_id,plan_key,status');

        if ($request->filled('search')) {
            $s = '%'.$request->string('search').'%';
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', $s)
                    ->orWhere('slug', 'like', $s)
                    ->orWhere('address', 'like', $s);
            });
        }

        $perPage = min(48, max(6, (int) $request->query('per_page', 24)));

        return response()->json($query->orderBy('name')->paginate($perPage));
    }

    public function show(int $shopId): JsonResponse
    {
        $shop = Shop::query()
            ->publiclyBookable()
            ->with(['subscription:id,shop_id,plan_key,status'])
            ->whereKey($shopId)
            ->firstOrFail();

        $services = SalonService::query()
            ->where('shop_id', $shop->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'category', 'duration_minutes', 'buffer_after_minutes', 'price_cents']);

        $staff = SalonStaff::query()
            ->where('shop_id', $shop->id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get(['id', 'name', 'bio', 'photo_url', 'specialties']);

        $reviewStats = SalonReview::query()
            ->where('shop_id', $shop->id)
            ->whereNull('flagged_at')
            ->selectRaw('COUNT(*) as count, AVG(rating) as avg_rating')
            ->first();

        $recentReviews = SalonReview::query()
            ->where('shop_id', $shop->id)
            ->whereNull('flagged_at')
            ->with(['staff:id,name'])
            ->orderByDesc('created_at')
            ->limit(12)
            ->get();

        return response()->json([
            'data' => [
                'shop' => $this->shopPayload($shop),
                'services' => $services,
                'staff' => $staff,
                'reviews_summary' => [
                    'count' => (int) ($reviewStats->count ?? 0),
                    'avg_rating' => $reviewStats && $reviewStats->avg_rating !== null
                        ? round((float) $reviewStats->avg_rating, 2)
                        : null,
                ],
                'reviews' => $recentReviews->map(fn (SalonReview $r) => [
                    'id' => $r->id,
                    'rating' => $r->rating,
                    'comment' => $r->comment,
                    'created_at' => $r->created_at?->toIso8601String(),
                    'staff_name' => $r->staff?->name,
                ]),
            ],
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function shopPayload(Shop $shop): array
    {
        return [
            'id' => $shop->id,
            'name' => $shop->name,
            'slug' => $shop->slug,
            'description' => $shop->description,
            'phone' => $shop->phone,
            'email' => $shop->email,
            'address' => $shop->address,
            'latitude' => $shop->latitude,
            'longitude' => $shop->longitude,
            'photos' => $shop->photos ?? [],
            'parent_shop_id' => $shop->parent_shop_id,
        ];
    }
}
