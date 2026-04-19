<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SalonReview;
use App\Models\SalonStaff;
use Illuminate\Http\JsonResponse;

class PublicBarberProfileController extends Controller
{
    public function show(int $staffId): JsonResponse
    {
        $staff = SalonStaff::query()
            ->with(['shop:id,name,slug,is_active'])
            ->whereKey($staffId)
            ->firstOrFail();

        if (! $staff->shop || ! $staff->shop->is_active) {
            abort(404);
        }

        $stats = SalonReview::query()
            ->where('salon_staff_id', $staff->id)
            ->whereNull('flagged_at')
            ->selectRaw('COUNT(*) as count, AVG(rating) as avg_rating')
            ->first();

        $recent = SalonReview::query()
            ->where('salon_staff_id', $staff->id)
            ->whereNull('flagged_at')
            ->orderByDesc('created_at')
            ->limit(10)
            ->get(['id', 'rating', 'comment', 'created_at']);

        return response()->json([
            'data' => [
                'id' => $staff->id,
                'name' => $staff->name,
                'bio' => $staff->bio,
                'photo_url' => $staff->photo_url,
                'specialties' => $staff->specialties ?? [],
                'weekly_schedule' => $staff->weekly_schedule ?? null,
                'shop' => [
                    'id' => $staff->shop->id,
                    'name' => $staff->shop->name,
                    'slug' => $staff->shop->slug,
                ],
                'reviews_summary' => [
                    'count' => (int) ($stats->count ?? 0),
                    'avg_rating' => $stats && $stats->avg_rating !== null
                        ? round((float) $stats->avg_rating, 2)
                        : null,
                ],
                'recent_reviews' => $recent,
            ],
        ]);
    }
}
