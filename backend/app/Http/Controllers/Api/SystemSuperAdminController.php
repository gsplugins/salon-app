<?php

namespace App\Http\Controllers\Api;

use App\Enums\ShopRole;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\BkashPayment;
use App\Models\Shop;
use App\Models\ShopMember;
use App\Models\Subscription;
use App\Models\User;
use App\Services\JwtTokenService;
use Illuminate\Support\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SystemSuperAdminController extends Controller
{
    public function __construct(
        private readonly JwtTokenService $tokens
    ) {}

    public function shops(Request $request): JsonResponse
    {
        $query = Shop::query()->with([
            'owner:id,name,mobile,role,is_locked,created_at',
            'subscription',
        ]);

        if ($request->query('search')) {
            $s = '%'.$request->query('search').'%';
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', $s)
                    ->orWhere('slug', 'like', $s)
                    ->orWhereHas('owner', function ($q2) use ($s) {
                        $q2->where('name', 'like', $s)->orWhere('mobile', 'like', $s);
                    });
            });
        }

        $filter = (string) $request->query('filter', 'all');
        $this->applyShopSubscriptionFilter($query, $filter);

        $rows = $query->orderByDesc('id')->paginate(50);
        $shopIds = $rows->getCollection()->pluck('id')->values();
        $paymentSummaryByShop = $this->paymentSummaryByShop($shopIds);
        $rows->getCollection()->transform(function (Shop $shop) use ($paymentSummaryByShop) {
            return $this->formatShopRow($shop, $paymentSummaryByShop[$shop->id] ?? null);
        });

        return response()->json($rows);
    }

    /**
     * @param \Illuminate\Database\Eloquent\Builder<\App\Models\Shop> $query
     */
    private function applyShopSubscriptionFilter($query, string $filter): void
    {
        $filter = strtolower($filter);
        if ($filter === 'all' || $filter === '') {
            return;
        }

        if ($filter === 'locked') {
            $query->whereHas('owner', fn ($q) => $q->where('is_locked', true));

            return;
        }

        if ($filter === 'paid') {
            $query->whereHas('subscription', function ($q) {
                $q->where(function ($inner) {
                    $inner->where(function ($t) {
                        $t->where('status', SubscriptionStatus::Trialing->value)
                            ->where(function ($d) {
                                $d->whereNull('trial_ends_at')
                                    ->orWhere('trial_ends_at', '>', now());
                            });
                    })->orWhere(function ($a) {
                        $a->where('status', SubscriptionStatus::Active->value)
                            ->where(function ($d) {
                                $d->whereNull('current_period_end')
                                    ->orWhere('current_period_end', '>', now());
                            });
                    });
                });
            });

            return;
        }

        if ($filter === 'unpaid') {
            $query->where(function ($q) {
                $q->whereDoesntHave('subscription')
                    ->orWhereHas('subscription', fn ($s) => $s->where('status', SubscriptionStatus::PastDue->value));
            });

            return;
        }

        if ($filter === 'expired') {
            $query->whereHas('subscription', function ($q) {
                $q->where('status', SubscriptionStatus::Cancelled->value)
                    ->orWhere(function ($q2) {
                        $q2->where('status', SubscriptionStatus::Trialing->value)
                            ->whereNotNull('trial_ends_at')
                            ->where('trial_ends_at', '<=', now());
                    })
                    ->orWhere(function ($q2) {
                        $q2->where('status', SubscriptionStatus::Active->value)
                            ->whereNotNull('current_period_end')
                            ->where('current_period_end', '<=', now());
                    });
            });
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function formatShopRow(Shop $shop, ?array $paymentSummary = null): array
    {
        $shop->loadMissing([
            'owner:id,name,mobile,role,is_locked,created_at',
            'subscription',
        ]);

        $owner = $shop->owner;
        $sub = $shop->subscription;

        return [
            'id' => $shop->id,
            'name' => $shop->name,
            'slug' => $shop->slug,
            'is_active' => $shop->is_active,
            'created_at' => $shop->created_at?->toIso8601String(),
            'owner' => $owner ? [
                'id' => $owner->id,
                'name' => $owner->name,
                'mobile' => $owner->mobile,
                'role' => $owner->role?->value ?? 'customer',
                'is_locked' => (bool) $owner->is_locked,
                'created_at' => $owner->created_at?->toIso8601String(),
            ] : null,
            'subscription' => $sub ? [
                'id' => $sub->id,
                'plan_key' => $sub->plan_key,
                'status' => $sub->status instanceof SubscriptionStatus ? $sub->status->value : (string) $sub->status,
                'trial_ends_at' => $sub->trial_ends_at?->toIso8601String(),
                'current_period_end' => $sub->current_period_end?->toIso8601String(),
            ] : null,
            'approval_status' => (string) (($shop->settings['approval_status'] ?? null) ?: ($shop->is_active ? 'approved' : 'pending')),
            'staff_limit' => (int) (($shop->settings['staff_limit'] ?? 30)),
            'payment_summary' => $paymentSummary ?? [
                'total_paid_paisa' => 0,
                'payments_count' => 0,
                'last_payment_at' => null,
                'last_payment_amount_paisa' => null,
                'last_payment_status' => null,
            ],
        ];
    }

    public function storeShop(Request $request): JsonResponse
    {
        $data = $request->validate([
            'owner_mobile' => ['required', 'string', 'min:8', 'max:32'],
            'owner_name' => ['nullable', 'string', 'max:255'],
            'owner_password' => ['required', 'string', 'min:8'],
            'shop_name' => ['required', 'string', 'max:255'],
            'shop_slug' => ['required', 'string', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'max:64', 'unique:shops,slug'],
            'plan_key' => ['nullable', 'string', 'max:64'],
            'subscription_status' => ['nullable', Rule::enum(SubscriptionStatus::class)],
        ]);

        $mobile = preg_replace('/\D+/', '', $data['owner_mobile']) ?? '';
        if ($mobile === '') {
            throw ValidationException::withMessages(['owner_mobile' => ['Invalid mobile.']]);
        }

        if (User::query()->where('mobile', $mobile)->exists()) {
            throw ValidationException::withMessages(['owner_mobile' => ['Mobile already registered.']]);
        }

        $shop = DB::transaction(function () use ($data, $mobile) {
            $user = User::query()->create([
                'name' => $data['owner_name'] ?? 'Owner',
                'email' => null,
                'mobile' => $mobile,
                'password' => Hash::make($data['owner_password']),
                'is_admin' => false,
                'role' => UserRole::ShopOwner,
            ]);

            $shop = Shop::query()->create([
                'user_id' => $user->id,
                'name' => $data['shop_name'],
                'slug' => $data['shop_slug'],
                'description' => null,
                'is_active' => true,
                'settings' => null,
            ]);

            $status = isset($data['subscription_status'])
                ? SubscriptionStatus::from($data['subscription_status'])
                : SubscriptionStatus::Active;

            Subscription::query()->create([
                'shop_id' => $shop->id,
                'plan_key' => $data['plan_key'] ?? 'starter',
                'status' => $status,
                'trial_ends_at' => $status === SubscriptionStatus::Trialing ? now()->addDays(14) : null,
                'current_period_end' => in_array($status, [SubscriptionStatus::Active, SubscriptionStatus::Trialing], true)
                    ? now()->addMonth()
                    : null,
            ]);

            ShopMember::query()->create([
                'user_id' => $user->id,
                'shop_id' => $shop->id,
                'role' => ShopRole::Owner,
                'is_active' => true,
            ]);

            return $shop->load(['owner:id,name,mobile,role', 'subscription']);
        });

        return response()->json(['data' => $shop], 201);
    }

    public function updateShop(Request $request, int $id): JsonResponse
    {
        $shop = Shop::query()->findOrFail($id);

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'max:64', Rule::unique('shops', 'slug')->ignore($shop->id)],
            'description' => ['nullable', 'string', 'max:5000'],
            'is_active' => ['sometimes', 'boolean'],
            'approval_status' => ['sometimes', 'string', Rule::in(['pending', 'approved', 'rejected'])],
            'staff_limit' => ['sometimes', 'integer', 'min:1', 'max:500'],
        ]);

        $shop->fill($data);
        if (array_key_exists('approval_status', $data) || array_key_exists('staff_limit', $data)) {
            $settings = is_array($shop->settings) ? $shop->settings : [];
            if (array_key_exists('approval_status', $data)) {
                $settings['approval_status'] = $data['approval_status'];
                if ($data['approval_status'] === 'approved') {
                    $shop->is_active = true;
                } elseif ($data['approval_status'] === 'rejected') {
                    $shop->is_active = false;
                }
            }
            if (array_key_exists('staff_limit', $data)) {
                $settings['staff_limit'] = (int) $data['staff_limit'];
            }
            $shop->settings = $settings;
        }
        $shop->save();

        $shop = $shop->fresh(['owner:id,name,mobile,role,is_locked,created_at', 'subscription']);
        $paymentSummaryByShop = $this->paymentSummaryByShop(collect([$shop->id]));

        return response()->json(['data' => $this->formatShopRow($shop, $paymentSummaryByShop[$shop->id] ?? null)]);
    }

    public function destroyShop(int $id): JsonResponse
    {
        $shop = Shop::query()->findOrFail($id);
        $shop->delete();

        return response()->json(['message' => 'Shop deleted.']);
    }

    /**
     * @param Collection<int, int|string> $shopIds
     * @return array<int, array<string, int|string|null>>
     */
    private function paymentSummaryByShop(Collection $shopIds): array
    {
        $ids = $shopIds->map(fn ($id) => (int) $id)->filter(fn ($id) => $id > 0)->values();
        if ($ids->isEmpty()) {
            return [];
        }

        $totals = BkashPayment::query()
            ->selectRaw('shop_id, COALESCE(SUM(amount_paisa),0) as total_paid_paisa, COUNT(*) as payments_count, MAX(created_at) as last_payment_at')
            ->whereIn('shop_id', $ids->all())
            ->where('status', 'completed')
            ->groupBy('shop_id')
            ->get()
            ->keyBy('shop_id');

        $latestRows = BkashPayment::query()
            ->whereIn('shop_id', $ids->all())
            ->orderByDesc('id')
            ->get()
            ->groupBy('shop_id')
            ->map(fn ($rows) => $rows->first());

        $out = [];
        foreach ($ids as $id) {
            $t = $totals->get($id);
            $last = $latestRows->get($id);
            $out[$id] = [
                'total_paid_paisa' => $t ? (int) $t->total_paid_paisa : 0,
                'payments_count' => $t ? (int) $t->payments_count : 0,
                'last_payment_at' => $last?->created_at?->toIso8601String(),
                'last_payment_amount_paisa' => $last ? (int) $last->amount_paisa : null,
                'last_payment_status' => $last?->status,
            ];
        }

        return $out;
    }

    public function users(Request $request): JsonResponse
    {
        $query = User::query()->select(['id', 'name', 'mobile', 'role', 'is_admin', 'is_locked', 'created_at']);

        if ($request->query('search')) {
            $s = '%'.$request->query('search').'%';
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', $s)->orWhere('mobile', 'like', $s);
            });
        }

        return response()->json($query->orderByDesc('id')->paginate(50));
    }

    public function updateUser(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'role' => ['sometimes', Rule::enum(UserRole::class)],
            'password' => ['sometimes', 'string', 'min:8'],
            'is_locked' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['is_locked']) && $data['is_locked'] && $user->isSuperAdmin()) {
            throw ValidationException::withMessages(['is_locked' => ['Cannot lock a super admin account.']]);
        }

        if (isset($data['name'])) {
            $user->name = $data['name'];
        }
        if (isset($data['role'])) {
            $role = $data['role'] instanceof UserRole ? $data['role'] : UserRole::from((string) $data['role']);
            $user->role = $role;
            $user->is_admin = in_array($role, [UserRole::Barber, UserRole::ShopOwner, UserRole::Manager, UserRole::SuperAdmin], true);
        }
        if (isset($data['password'])) {
            $user->password = $data['password'];
        }
        if (isset($data['is_locked'])) {
            $wasLocked = (bool) $user->is_locked;
            $user->is_locked = $data['is_locked'];
            if ($data['is_locked'] && ! $wasLocked) {
                $this->tokens->revokeAllRefreshTokensForUser($user);
            }
        }
        $user->save();

        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'mobile' => $user->mobile,
                'role' => $user->role->value,
                'is_locked' => (bool) $user->is_locked,
            ],
        ]);
    }

    public function resetUserPassword(Request $request, User $user): JsonResponse
    {
        if ($user->isSuperAdmin()) {
            return response()->json(['message' => 'Use a separate process for super admin credentials.'], 403);
        }

        $data = $request->validate([
            'password' => ['required', 'string', 'min:8'],
        ]);

        $user->password = $data['password'];
        $user->save();
        $this->tokens->revokeAllRefreshTokensForUser($user);

        return response()->json(['message' => 'Password updated. Sessions were signed out.']);
    }

    public function updateSubscription(Request $request, Subscription $subscription): JsonResponse
    {
        $data = $request->validate([
            'plan_key' => ['sometimes', 'string', 'max:64'],
            'status' => ['sometimes', Rule::enum(SubscriptionStatus::class)],
            'trial_ends_at' => ['nullable', 'date'],
            'current_period_end' => ['nullable', 'date'],
        ]);

        if (isset($data['plan_key'])) {
            $subscription->plan_key = $data['plan_key'];
        }
        if (isset($data['status'])) {
            $subscription->status = $data['status'] instanceof SubscriptionStatus
                ? $data['status']
                : SubscriptionStatus::from((string) $data['status']);
        }
        if (array_key_exists('trial_ends_at', $data)) {
            $subscription->trial_ends_at = $data['trial_ends_at'];
        }
        if (array_key_exists('current_period_end', $data)) {
            $subscription->current_period_end = $data['current_period_end'];
        }
        $subscription->save();

        return response()->json(['data' => $subscription->fresh()]);
    }

    public function extendSubscription(Request $request, Subscription $subscription): JsonResponse
    {
        $data = $request->validate([
            'days' => ['required', 'integer', 'min:1', 'max:3650'],
        ]);

        $base = $subscription->current_period_end !== null && $subscription->current_period_end->isFuture()
            ? $subscription->current_period_end->copy()
            : now()->copy();

        $subscription->current_period_end = $base->addDays($data['days']);

        if (in_array($subscription->status, [SubscriptionStatus::PastDue, SubscriptionStatus::Cancelled], true)) {
            $subscription->status = SubscriptionStatus::Active;
        }

        $subscription->save();

        return response()->json(['data' => $subscription->fresh()]);
    }

    public function bkashPayments(Request $request): JsonResponse
    {
        $query = BkashPayment::query()->with(['shop:id,name,slug']);

        if ($request->query('shop_id')) {
            $query->where('shop_id', (int) $request->query('shop_id'));
        }
        if ($request->query('status')) {
            $query->where('status', (string) $request->query('status'));
        }

        return response()->json($query->orderByDesc('id')->paginate(50));
    }

    public function storeBkashPayment(Request $request): JsonResponse
    {
        $data = $request->validate([
            'shop_id' => ['required', 'integer', Rule::exists('shops', 'id')],
            'amount_paisa' => ['required', 'integer', 'min:0'],
            'trx_id' => ['nullable', 'string', 'max:64', 'unique:bkash_payments,trx_id'],
            'status' => ['nullable', 'string', 'max:32'],
            'payer_mobile' => ['nullable', 'string', 'max:32'],
            'note' => ['nullable', 'string', 'max:2000'],
        ]);

        $row = BkashPayment::query()->create([
            'shop_id' => $data['shop_id'],
            'amount_paisa' => $data['amount_paisa'],
            'trx_id' => $data['trx_id'] ?? null,
            'status' => $data['status'] ?? 'completed',
            'payer_mobile' => $data['payer_mobile'] ?? null,
            'note' => $data['note'] ?? null,
        ]);

        return response()->json(['data' => $row->load('shop:id,name,slug')], 201);
    }
}
