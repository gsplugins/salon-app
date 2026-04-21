<?php

namespace App\Http\Controllers\Api\Admin;

use App\Enums\SubscriptionStatus;
use App\Http\Controllers\Controller;
use App\Models\Shop;
use App\Models\Subscription;
use App\Models\SubscriptionPlan;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminShopSubscriptionController extends Controller
{
    public function updateForShop(Request $request, Shop $shop): JsonResponse
    {
        $data = $request->validate([
            'subscription_plan_id' => ['required', 'integer', Rule::exists('subscription_plans', 'id')],
        ]);

        $plan = SubscriptionPlan::query()->findOrFail((int) $data['subscription_plan_id']);
        if (! $plan->is_active) {
            return response()->json(['message' => 'Selected plan is inactive.'], 422);
        }

        $subscription = $shop->subscription ?? Subscription::query()->create([
            'shop_id' => $shop->id,
            'plan_key' => $plan->slug,
            'status' => SubscriptionStatus::Active,
            'trial_ends_at' => null,
            'current_period_end' => now()->addMonth(),
        ]);

        $subscription->subscription_plan_id = $plan->id;
        $subscription->plan_key = $plan->slug;
        $subscription->save();

        AdminAudit::record($request->user(), $request, 'shop.subscription.assign', 'shop', (int) $shop->id, [
            'plan_slug' => $plan->slug,
        ]);

        return response()->json(['data' => $subscription->fresh(['plan'])]);
    }
}
