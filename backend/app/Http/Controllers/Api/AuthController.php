<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PasswordResetOtp;
use App\Models\User;
use App\Services\JwtTokenService;
use App\Services\Sms\SmsSender;
use App\Support\MobileNormalizer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
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
        ]);

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

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'mobile' => $user->mobile,
            'is_admin' => (bool) $user->is_admin,
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
