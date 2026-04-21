<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SubscriptionPlan;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminSubscriptionPlanController extends Controller
{
    public function index(): JsonResponse
    {
        $rows = SubscriptionPlan::query()->orderBy('sort_order')->orderBy('id')->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'unique:subscription_plans,slug'],
            'name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'price_cents' => ['required', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:8'],
            'billing_cycle' => ['required', Rule::in(['monthly', 'yearly'])],
            'trial_days' => ['sometimes', 'integer', 'min:0', 'max:3650'],
            'features' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
        ]);

        $plan = SubscriptionPlan::query()->create([
            'slug' => $data['slug'],
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'price_cents' => $data['price_cents'],
            'currency' => $data['currency'] ?? 'BDT',
            'billing_cycle' => $data['billing_cycle'],
            'trial_days' => $data['trial_days'] ?? 0,
            'features' => $data['features'] ?? [],
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
        ]);

        AdminAudit::record($request->user(), $request, 'subscription_plan.create', 'subscription_plan', (int) $plan->id);

        return response()->json(['data' => $plan], 201);
    }

    public function update(Request $request, SubscriptionPlan $plan): JsonResponse
    {
        $data = $request->validate([
            'slug' => ['sometimes', 'string', 'max:64', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', Rule::unique('subscription_plans', 'slug')->ignore($plan->id)],
            'name' => ['sometimes', 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'price_cents' => ['sometimes', 'integer', 'min:0'],
            'currency' => ['sometimes', 'string', 'max:8'],
            'billing_cycle' => ['sometimes', Rule::in(['monthly', 'yearly'])],
            'trial_days' => ['sometimes', 'integer', 'min:0', 'max:3650'],
            'features' => ['nullable', 'array'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['sometimes', 'integer', 'min:0', 'max:65535'],
        ]);

        $plan->fill($data);
        $plan->save();

        AdminAudit::record($request->user(), $request, 'subscription_plan.update', 'subscription_plan', (int) $plan->id);

        return response()->json(['data' => $plan->fresh()]);
    }

    public function destroy(Request $request, SubscriptionPlan $plan): JsonResponse
    {
        if ($plan->subscriptions()->exists()) {
            return response()->json(['message' => 'Cannot delete a plan that is assigned to shops.'], 422);
        }

        $id = (int) $plan->id;
        $plan->delete();

        AdminAudit::record($request->user(), $request, 'subscription_plan.delete', 'subscription_plan', $id);

        return response()->json(['message' => 'Plan deleted.']);
    }
}
