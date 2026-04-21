<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffServiceController extends Controller
{
    use ResolvesStaffProfile;

    public function index(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $staff->load(['services' => function ($q) {
            $q->where('is_active', true)->orderBy('sort_order')->orderBy('name');
        }]);

        $rows = $staff->services->map(fn ($s) => [
            'id' => $s->id,
            'name' => $s->name,
            'category' => $s->category,
            'description' => null,
            'duration_minutes' => $s->duration_minutes,
            'price_cents' => $s->price_cents,
        ]);

        return response()->json(['data' => $rows->values()]);
    }
}
