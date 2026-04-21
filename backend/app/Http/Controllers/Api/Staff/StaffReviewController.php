<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\SalonReview;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffReviewController extends Controller
{
    use ResolvesStaffProfile;

    public function index(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'rating' => ['nullable', 'integer', 'min:1', 'max:5'],
        ]);

        $q = SalonReview::query()
            ->where('salon_staff_id', $staff->id)
            ->orderByDesc('id')
            ->limit(200);

        if (isset($data['rating'])) {
            $q->where('rating', $data['rating']);
        }

        $rows = $q->get();
        $avg = SalonReview::query()->where('salon_staff_id', $staff->id)->avg('rating');

        return response()->json([
            'data' => [
                'average_rating' => $avg !== null ? round((float) $avg, 2) : null,
                'count' => $rows->count(),
                'reviews' => $rows->map(fn (SalonReview $r) => [
                    'id' => $r->id,
                    'rating' => $r->rating,
                    'comment' => $r->comment,
                    'created_at' => $r->created_at?->toIso8601String(),
                ]),
            ],
        ]);
    }
}
