<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\StaffLeaveRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StaffLeaveRequestController extends Controller
{
    use ResolvesStaffProfile;

    public function index(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $rows = StaffLeaveRequest::query()
            ->where('salon_staff_id', $staff->id)
            ->orderByDesc('date')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => $rows->map(fn (StaffLeaveRequest $r) => [
                'id' => $r->id,
                'date' => $r->date->toDateString(),
                'reason' => $r->reason,
                'status' => $r->status,
                'manager_note' => $r->manager_note,
                'created_at' => $r->created_at?->toIso8601String(),
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'date' => ['required', 'date'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $row = StaffLeaveRequest::query()->create([
            'salon_staff_id' => $staff->id,
            'shop_id' => $staff->shop_id,
            'date' => $data['date'],
            'reason' => $data['reason'],
            'status' => 'pending',
        ]);

        return response()->json([
            'data' => [
                'id' => $row->id,
                'date' => $row->date->toDateString(),
                'reason' => $row->reason,
                'status' => $row->status,
            ],
        ], 201);
    }
}
