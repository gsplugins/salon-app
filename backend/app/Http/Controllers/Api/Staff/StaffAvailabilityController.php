<?php

namespace App\Http\Controllers\Api\Staff;

use App\Http\Controllers\Controller;
use App\Models\StaffAvailabilityBlock;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StaffAvailabilityController extends Controller
{
    use ResolvesStaffProfile;

    public function show(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);

        return response()->json([
            'data' => [
                'availability_status' => $staff->availability_status ?? 'available',
            ],
        ]);
    }

    public function updateStatus(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'availability_status' => ['required', 'string', Rule::in(['available', 'busy', 'on_leave'])],
        ]);
        $staff->availability_status = $data['availability_status'];
        $staff->save();

        return response()->json(['data' => ['availability_status' => $staff->availability_status]]);
    }

    public function blocks(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);
        $tz = config('app.timezone');
        $from = isset($data['from'])
            ? CarbonImmutable::parse($data['from'])->timezone($tz)->startOfDay()
            : now()->timezone($tz)->startOfWeek();
        $to = isset($data['to'])
            ? CarbonImmutable::parse($data['to'])->timezone($tz)->endOfDay()
            : now()->timezone($tz)->addWeeks(2)->endOfDay();

        $rows = StaffAvailabilityBlock::query()
            ->where('salon_staff_id', $staff->id)
            ->whereBetween('starts_at', [$from, $to])
            ->orderBy('starts_at')
            ->get();

        return response()->json([
            'data' => $rows->map(fn (StaffAvailabilityBlock $b) => [
                'id' => $b->id,
                'starts_at' => $b->starts_at->toIso8601String(),
                'ends_at' => $b->ends_at->toIso8601String(),
                'kind' => $b->kind,
                'note' => $b->note,
            ]),
        ]);
    }

    public function storeBlock(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'note' => ['nullable', 'string', 'max:500'],
            'kind' => ['nullable', 'string', 'max:32'],
        ]);

        $row = StaffAvailabilityBlock::query()->create([
            'salon_staff_id' => $staff->id,
            'shop_id' => $staff->shop_id,
            'starts_at' => CarbonImmutable::parse($data['starts_at'])->timezone(config('app.timezone')),
            'ends_at' => CarbonImmutable::parse($data['ends_at'])->timezone(config('app.timezone')),
            'kind' => $data['kind'] ?? 'custom',
            'note' => $data['note'] ?? null,
        ]);

        return response()->json([
            'data' => [
                'id' => $row->id,
                'starts_at' => $row->starts_at->toIso8601String(),
                'ends_at' => $row->ends_at->toIso8601String(),
            ],
        ], 201);
    }

    public function destroyBlock(Request $request, StaffAvailabilityBlock $block): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        if ((int) $block->salon_staff_id !== (int) $staff->id) {
            abort(404);
        }
        $block->delete();

        return response()->json(['data' => ['ok' => true]]);
    }
}
