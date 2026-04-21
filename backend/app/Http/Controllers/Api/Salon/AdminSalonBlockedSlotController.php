<?php

namespace App\Http\Controllers\Api\Salon;

use App\Enums\BlockedSlotKind;
use App\Http\Controllers\Controller;
use App\Models\SalonBlockedSlot;
use App\Models\SalonStaff;
use App\Models\Shop;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminSalonBlockedSlotController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $this->shopOrAbort($request);
        $actor = $this->userOrAbort($request);
        $staffScopeId = $this->staffScopeId($actor, $shop);
        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date', 'after_or_equal:from'],
        ]);

        $from = CarbonImmutable::parse($data['from'])->timezone(config('app.timezone'))->startOfDay();
        $to = CarbonImmutable::parse($data['to'])->timezone(config('app.timezone'))->endOfDay();

        $rows = SalonBlockedSlot::query()
            ->where('shop_id', $shop->id)
            ->with('staff:id,name')
            ->where('starts_at', '<', $to)
            ->where('ends_at', '>', $from)
            ->orderBy('starts_at')
            ->get();
        if ($staffScopeId !== null) {
            $rows = $rows->where('salon_staff_id', $staffScopeId)->values();
        }

        return response()->json([
            'data' => $rows->map(fn (SalonBlockedSlot $b) => [
                'id' => $b->id,
                'salon_staff_id' => $b->salon_staff_id,
                'staff' => $b->salon_staff_id ? ['id' => $b->staff->id, 'name' => $b->staff->name] : null,
                'scope' => $b->salon_staff_id ? 'staff' : 'shop',
                'starts_at' => $b->starts_at->toIso8601String(),
                'ends_at' => $b->ends_at->toIso8601String(),
                'kind' => $b->kind->value,
                'reason' => $b->reason,
            ])->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $shop = $this->shopOrAbort($request);
        $actor = $this->userOrAbort($request);
        $staffScopeId = $this->staffScopeId($actor, $shop);
        $data = $request->validate([
            'salon_staff_id' => [
                'nullable',
                'integer',
                Rule::exists('salon_staff', 'id')->where('shop_id', $shop->id),
            ],
            'starts_at' => ['required', 'date'],
            'ends_at' => ['required', 'date', 'after:starts_at'],
            'kind' => ['required', Rule::enum(BlockedSlotKind::class)],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);
        if ($staffScopeId !== null) {
            $data['salon_staff_id'] = $staffScopeId;
        }

        $starts = CarbonImmutable::parse($data['starts_at'])->timezone(config('app.timezone'));
        $ends = CarbonImmutable::parse($data['ends_at'])->timezone(config('app.timezone'));

        if ($ends->lte($starts)) {
            throw ValidationException::withMessages([
                'ends_at' => ['End time must be after start time.'],
            ]);
        }

        $row = SalonBlockedSlot::query()->create([
            'shop_id' => $shop->id,
            'salon_staff_id' => $data['salon_staff_id'] ?? null,
            'starts_at' => $starts,
            'ends_at' => $ends,
            'kind' => BlockedSlotKind::from($data['kind']),
            'reason' => $data['reason'] ?? null,
        ]);

        $row->load('staff:id,name');

        return response()->json([
            'data' => [
                'id' => $row->id,
                'salon_staff_id' => $row->salon_staff_id,
                'staff' => $row->salon_staff_id ? ['id' => $row->staff->id, 'name' => $row->staff->name] : null,
                'scope' => $row->salon_staff_id ? 'staff' : 'shop',
                'starts_at' => $row->starts_at->toIso8601String(),
                'ends_at' => $row->ends_at->toIso8601String(),
                'kind' => $row->kind->value,
                'reason' => $row->reason,
            ],
        ], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $shop = $this->shopOrAbort($request);
        $actor = $this->userOrAbort($request);
        $staffScopeId = $this->staffScopeId($actor, $shop);
        $row = SalonBlockedSlot::query()
            ->where('shop_id', $shop->id)
            ->whereKey($id)
            ->firstOrFail();
        if ($staffScopeId !== null && (int) $row->salon_staff_id !== $staffScopeId) {
            abort(403, 'You can only remove your own blocked slots.');
        }
        $row->delete();

        return response()->json(['message' => 'Blocked slot removed.']);
    }

    private function shopOrAbort(Request $request): Shop
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

    private function userOrAbort(Request $request): User
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $user->loadMissing('staffProfile');

        return $user;
    }

    private function staffScopeId(User $user, Shop $shop): ?int
    {
        if ($user->role !== \App\Enums\UserRole::Barber) {
            return null;
        }
        $sp = $user->staffProfile;
        if (! $sp instanceof SalonStaff || (int) $sp->shop_id !== (int) $shop->id) {
            abort(403, 'No staff profile for this shop.');
        }

        return (int) $sp->id;
    }
}
