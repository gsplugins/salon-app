<?php

namespace App\Http\Controllers\Api;

use App\Enums\ShopRole;
use App\Enums\SubscriptionStatus;
use App\Enums\UserRole;
use App\Http\Controllers\Controller;
use App\Models\PasswordResetOtp;
use App\Models\Shop;
use App\Models\ShopMember;
use App\Models\Subscription;
use App\Models\User;
use App\Services\JwtTokenService;
use App\Services\Sms\SmsSender;
use App\Support\MobileNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly JwtTokenService $tokens,
        private readonly SmsSender $sms
    ) {}

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mobile' => ['required', 'string', 'min:8', 'max:32'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'name' => ['nullable', 'string', 'max:255'],
        ]);

        $mobile = MobileNormalizer::normalize($data['mobile']);
        if ($mobile === '') {
            throw ValidationException::withMessages([
                'mobile' => ['Invalid mobile number.'],
            ]);
        }

        if (User::query()->where('mobile', $mobile)->exists()) {
            throw ValidationException::withMessages([
                'mobile' => ['This mobile number is already registered.'],
            ]);
        }

        $user = User::query()->create([
            'name' => $data['name'] ?? 'Guest',
            'email' => null,
            'mobile' => $mobile,
            'password' => $data['password'],
            'is_admin' => false,
            'role' => UserRole::Customer,
        ]);

        return response()->json($this->buildTokenBody($user), 201);
    }

    public function registerBarber(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mobile' => ['required', 'string', 'min:8', 'max:32'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'name' => ['nullable', 'string', 'max:255'],
            'shop_name' => ['required', 'string', 'max:255'],
            'shop_slug' => ['required', 'string', 'regex:/^[a-z0-9]+(?:-[a-z0-9]+)*$/', 'max:64', Rule::unique('shops', 'slug')],
            'description' => ['nullable', 'string', 'max:2000'],
        ]);

        $mobile = MobileNormalizer::normalize($data['mobile']);
        if ($mobile === '') {
            throw ValidationException::withMessages([
                'mobile' => ['Invalid mobile number.'],
            ]);
        }

        if (User::query()->where('mobile', $mobile)->exists()) {
            throw ValidationException::withMessages([
                'mobile' => ['This mobile number is already registered.'],
            ]);
        }

        $user = DB::transaction(function () use ($data, $mobile) {
            $user = User::query()->create([
                'name' => $data['name'] ?? 'Shop owner',
                'email' => null,
                'mobile' => $mobile,
                'password' => $data['password'],
                'is_admin' => false,
                'role' => UserRole::ShopOwner,
            ]);

            $shop = Shop::query()->create([
                'user_id' => $user->id,
                'name' => $data['shop_name'],
                'slug' => $data['shop_slug'],
                'description' => $data['description'] ?? null,
                'is_active' => true,
                'settings' => null,
            ]);

            Subscription::query()->create([
                'shop_id' => $shop->id,
                'plan_key' => 'starter',
                'status' => SubscriptionStatus::Trialing,
                'trial_ends_at' => now()->addDays(14),
                'current_period_end' => now()->addDays(14),
                'stripe_customer_id' => null,
                'stripe_subscription_id' => null,
            ]);

            ShopMember::query()->create([
                'user_id' => $user->id,
                'shop_id' => $shop->id,
                'role' => ShopRole::Owner,
                'is_active' => true,
            ]);

            return $user;
        });

        return response()->json($this->buildTokenBody($user), 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mobile' => ['required', 'string'],
            'password' => ['required', 'string'],
        ]);

        $mobile = MobileNormalizer::normalize($data['mobile']);
        $user = User::query()->where('mobile', $mobile)->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials.'], 401);
        }

        if ($user->is_locked) {
            return response()->json(['message' => 'Account is locked. Contact support.'], 403);
        }

        return response()->json($this->buildTokenBody($user));
    }

    public function refresh(Request $request): JsonResponse
    {
        $data = $request->validate([
            'refresh_token' => ['required', 'string'],
        ]);

        $result = $this->tokens->exchangeRefreshToken($data['refresh_token']);
        if ($result === null) {
            return response()->json(['message' => 'Invalid refresh token.'], 401);
        }

        $expSeconds = max(60, (int) config('jwt.access_ttl_minutes', 10080)) * 60;

        return response()->json([
            'access_token' => $result['access_token'],
            'token_type' => 'Bearer',
            'expires_in' => $expSeconds,
            'refresh_token' => $result['refresh_token'],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'refresh_token' => ['nullable', 'string'],
        ]);

        if (! empty($data['refresh_token'])) {
            $this->tokens->revokeRefreshToken($data['refresh_token']);
        } else {
            $user = $request->user();
            if ($user instanceof User) {
                $this->tokens->revokeAllRefreshTokensForUser($user);
            }
        }

        return response()->json(['message' => 'Logged out.']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $user instanceof User) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user->loadMissing(['shops.subscription', 'staffProfile.shop.subscription', 'shopMembers']);

        $shop = $user->primaryShop();
        $sub = $shop?->subscription;
        $canViewBilling = $user->canViewShopBilling($shop);

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'mobile' => $user->mobile,
            'role' => $user->role?->value ?? 'customer',
            'global_role' => $user->isSuperAdmin() ? 'super_admin' : 'user',
            'loyalty_points' => $user->loyalty_points ?? 0,
            'is_super_admin' => $user->isSuperAdmin(),
            'is_shop_owner' => $user->isShopOwner(),
            'is_manager' => $user->isManager(),
            'is_barber' => $user->isBarber(),
            'is_admin' => $user->hasSalonManagementAccess(),
            'shop_access' => [
                'shop_id' => $shop?->id,
                'role' => $user->shopAccessRoleLabel($shop),
            ],
            'shop' => $shop ? [
                'id' => $shop->id,
                'name' => $shop->name,
                'slug' => $shop->slug,
                'description' => $shop->description,
                'is_active' => $shop->is_active,
            ] : null,
            'subscription' => ($sub && $canViewBilling) ? [
                'status' => $sub->status->value,
                'plan_key' => $sub->plan_key,
                'trial_ends_at' => $sub->trial_ends_at?->toIso8601String(),
                'current_period_end' => $sub->current_period_end?->toIso8601String(),
            ] : null,
        ]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mobile' => ['required', 'string'],
        ]);

        $mobile = MobileNormalizer::normalize($data['mobile']);

        $message = 'If this mobile is registered, an OTP was sent.';

        $user = User::query()->where('mobile', $mobile)->first();
        if (! $user) {
            return response()->json(['message' => $message]);
        }

        PasswordResetOtp::query()->where('mobile', $mobile)->delete();

        $otp = str_pad((string) random_int(0, 999_999), 6, '0', STR_PAD_LEFT);

        PasswordResetOtp::query()->create([
            'mobile' => $mobile,
            'otp_hash' => Hash::make($otp),
            'expires_at' => now()->addMinutes(15),
        ]);

        $this->sms->send($mobile, "Your password reset code is {$otp}. It expires in 15 minutes.");

        return response()->json(['message' => $message]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'mobile' => ['required', 'string'],
            'otp' => ['required', 'string', 'size:6'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $mobile = MobileNormalizer::normalize($data['mobile']);

        $user = User::query()->where('mobile', $mobile)->first();
        if (! $user) {
            throw ValidationException::withMessages([
                'mobile' => ['Invalid or expired OTP.'],
            ]);
        }

        $otpRow = PasswordResetOtp::query()
            ->where('mobile', $mobile)
            ->where('expires_at', '>', now())
            ->orderByDesc('id')
            ->first();

        if (! $otpRow || ! Hash::check($data['otp'], $otpRow->otp_hash)) {
            throw ValidationException::withMessages([
                'otp' => ['Invalid or expired OTP.'],
            ]);
        }

        $user->password = $data['password'];
        $user->save();

        $otpRow->delete();
        PasswordResetOtp::query()->where('mobile', $mobile)->delete();

        $this->tokens->revokeAllRefreshTokensForUser($user);

        return response()->json(['message' => 'Password updated. Sign in again.']);
    }

    /**
     * @return array<string, mixed>
     */
    private function buildTokenBody(User $user): array
    {
        $access = $this->tokens->issueAccessToken($user);
        [$refreshPlain] = $this->tokens->issueRefreshToken($user);
        $expSeconds = max(60, (int) config('jwt.access_ttl_minutes', 10080)) * 60;

        return [
            'access_token' => $access,
            'token_type' => 'Bearer',
            'expires_in' => $expSeconds,
            'refresh_token' => $refreshPlain,
        ];
    }
}
