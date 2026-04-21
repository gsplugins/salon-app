<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\StaffCustomerNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StaffCustomerController extends Controller
{
    use ResolvesStaffProfile;

    public function index(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $rows = DB::table('salon_bookings')
            ->where('salon_staff_id', $staff->id)
            ->selectRaw('customer_mobile, MAX(customer_name) as customer_name, COUNT(*) as visit_count, MAX(starts_at) as last_visit_at')
            ->groupBy('customer_mobile')
            ->orderByDesc('last_visit_at')
            ->limit(300)
            ->get();

        return response()->json([
            'data' => $rows->map(fn ($r) => [
                'customer_mobile' => $r->customer_mobile,
                'customer_name' => $r->customer_name,
                'visit_count' => (int) $r->visit_count,
                'last_visit_at' => $r->last_visit_at,
            ]),
        ]);
    }

    public function history(Request $request, string $mobile): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $decoded = rawurldecode($mobile);
        $bookings = SalonBooking::query()
            ->where('salon_staff_id', $staff->id)
            ->where('customer_mobile', $decoded)
            ->with(['service:id,name,duration_minutes,price_cents'])
            ->orderByDesc('starts_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $bookings->map(fn ($b) => [
                'id' => $b->id,
                'starts_at' => $b->starts_at->toIso8601String(),
                'status' => $b->status->value,
                'service' => [
                    'name' => $b->service?->name,
                    'duration_minutes' => $b->service?->duration_minutes,
                    'price_cents' => $b->service?->price_cents,
                ],
                'notes' => $b->notes,
            ]),
        ]);
    }

    public function storeNote(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'customer_mobile' => ['required', 'string', 'max:32'],
            'note' => ['required', 'string', 'max:5000'],
        ]);

        $note = StaffCustomerNote::query()->create([
            'salon_staff_id' => $staff->id,
            'shop_id' => $staff->shop_id,
            'customer_mobile' => $data['customer_mobile'],
            'note' => $data['note'],
        ]);

        return response()->json([
            'data' => [
                'id' => $note->id,
                'customer_mobile' => $note->customer_mobile,
                'note' => $note->note,
                'created_at' => $note->created_at?->toIso8601String(),
            ],
        ], 201);
    }

    public function notes(Request $request, string $mobile): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $decoded = rawurldecode($mobile);
        $rows = StaffCustomerNote::query()
            ->where('salon_staff_id', $staff->id)
            ->where('customer_mobile', $decoded)
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return response()->json([
            'data' => $rows->map(fn (StaffCustomerNote $n) => [
                'id' => $n->id,
                'note' => $n->note,
                'created_at' => $n->created_at?->toIso8601String(),
            ]),
        ]);
    }
}
