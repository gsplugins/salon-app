<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BkashPayment;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminAnalyticsController extends Controller
{
    public function summary(): JsonResponse
    {
        $shopsTotal = Shop::query()->count();
        $shopsActive = Shop::query()->where('is_active', true)->count();

        $activeSubs = Subscription::query()->whereIn('status', ['active', 'trialing'])->count();

        $mrrCents = (int) DB::table('subscriptions')
            ->leftJoin('subscription_plans', 'subscriptions.subscription_plan_id', '=', 'subscription_plans.id')
            ->whereIn('subscriptions.status', ['active', 'trialing'])
            ->where(function ($q) {
                $q->where('subscription_plans.billing_cycle', 'monthly')
                    ->orWhereNull('subscription_plans.billing_cycle');
            })
            ->sum(DB::raw('COALESCE(subscription_plans.price_cents, 0)'));

        $signupsWeek = User::query()->where('created_at', '>=', now()->subDays(7))->count();
        $signupsMonth = User::query()->where('created_at', '>=', now()->subDays(30))->count();

        $bkashRevenuePaisa = (int) BkashPayment::query()->where('status', 'completed')->sum('amount_paisa');

        $topShops = Shop::query()
            ->select(['shops.id', 'shops.name', 'shops.slug'])
            ->selectRaw(
                '(SELECT COALESCE(SUM(amount_paisa),0) FROM bkash_payments WHERE bkash_payments.shop_id = shops.id AND bkash_payments.status = ?) as revenue_paisa',
                ['completed']
            )
            ->orderByDesc('revenue_paisa')
            ->limit(8)
            ->get();

        return response()->json([
            'data' => [
                'shops_total' => $shopsTotal,
                'shops_active' => $shopsActive,
                'active_subscriptions' => $activeSubs,
                'mrr_cents_approx' => $mrrCents,
                'signups_last_7_days' => $signupsWeek,
                'signups_last_30_days' => $signupsMonth,
                'bkash_revenue_paisa_total' => $bkashRevenuePaisa,
                'top_shops_by_bkash' => $topShops,
            ],
        ]);
    }

    public function signupsSeries(Request $request): JsonResponse
    {
        $range = (string) $request->query('range', '30d');
        $days = match ($range) {
            '7d' => 7,
            '90d' => 90,
            default => 30,
        };

        $rows = User::query()
            ->selectRaw('DATE(created_at) as d, COUNT(*) as c')
            ->where('created_at', '>=', now()->subDays($days)->startOfDay())
            ->groupBy('d')
            ->orderBy('d')
            ->get();

        return response()->json(['data' => $rows]);
    }
}
