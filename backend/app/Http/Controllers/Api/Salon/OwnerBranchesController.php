<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Controller;
use App\Models\Shop;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OwnerBranchesController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $query = Shop::query()->with('parent:id,name')->orderBy('parent_shop_id')->orderBy('name');
        if (! $user->isSuperAdmin()) {
            $query->where('user_id', $user->id);
        }
        $rows = $query->get();

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['required', 'string', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'max:64', 'unique:shops,slug'],
            'description' => ['nullable', 'string', 'max:5000'],
            'parent_shop_id' => ['nullable', 'integer', Rule::exists('shops', 'id')->where('user_id', $user->id)],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:32'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
        ]);

        $branch = Shop::query()->create([
            'user_id' => $user->id,
            'parent_shop_id' => $data['parent_shop_id'] ?? null,
            'name' => $data['name'],
            'slug' => $data['slug'],
            'description' => $data['description'] ?? null,
            'address' => $data['address'] ?? null,
            'phone' => $data['phone'] ?? null,
            'latitude' => $data['latitude'] ?? null,
            'longitude' => $data['longitude'] ?? null,
            'is_active' => true,
            'settings' => null,
        ]);

        \App\Models\Subscription::query()->create([
            'shop_id' => $branch->id,
            'plan_key' => 'starter',
            'status' => \App\Enums\SubscriptionStatus::Active,
            'trial_ends_at' => null,
            'current_period_end' => now()->addYear(),
            'stripe_customer_id' => null,
            'stripe_subscription_id' => null,
        ]);

        return response()->json(['data' => $branch->fresh()], 201);
    }

    public function update(Request $request, int $shopId): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }

        $shop = Shop::query()->where('user_id', $user->id)->whereKey($shopId)->firstOrFail();

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'max:64', Rule::unique('shops', 'slug')->ignore($shop->id)],
            'description' => ['nullable', 'string', 'max:5000'],
            'address' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:32'],
            'is_active' => ['sometimes', 'boolean'],
            'latitude' => ['nullable', 'numeric'],
            'longitude' => ['nullable', 'numeric'],
            'photos' => ['nullable', 'array'],
        ]);

        $shop->fill($data);
        $shop->save();

        return response()->json(['data' => $shop->fresh()]);
    }
}
