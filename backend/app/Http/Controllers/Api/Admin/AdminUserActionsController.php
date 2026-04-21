<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\JwtTokenService;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class AdminUserActionsController extends Controller
{
    public function __construct(
        private readonly JwtTokenService $tokens
    ) {}

    public function impersonate(Request $request, User $user): JsonResponse
    {
        if ($user->isSuperAdmin()) {
            return response()->json(['message' => 'Cannot impersonate a super admin.'], 403);
        }
        if ($user->trashed()) {
            return response()->json(['message' => 'User not found.'], 404);
        }
        if ($user->is_locked) {
            return response()->json(['message' => 'User is locked.'], 422);
        }

        $access = $this->tokens->issueAccessToken($user);
        [$refreshPlain] = $this->tokens->issueRefreshToken($user);
        $expSeconds = max(60, (int) config('jwt.access_ttl_minutes', 10080)) * 60;

        AdminAudit::record($request->user(), $request, 'user.impersonate', 'user', (int) $user->id, [
            'target_mobile' => $user->mobile,
        ]);

        return response()->json([
            'access_token' => $access,
            'token_type' => 'Bearer',
            'expires_in' => $expSeconds,
            'refresh_token' => $refreshPlain,
            'user_id' => $user->id,
        ]);
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->isSuperAdmin()) {
            throw ValidationException::withMessages(['user' => ['Cannot delete a super admin account.']]);
        }
        if ((int) $user->id === (int) $request->user()?->id) {
            throw ValidationException::withMessages(['user' => ['Cannot delete your own account.']]);
        }

        if ($user->shops()->exists()) {
            return response()->json([
                'message' => 'This user owns one or more shops. Transfer ownership or delete shops first.',
            ], 422);
        }

        $id = (int) $user->id;
        $user->delete();

        AdminAudit::record($request->user(), $request, 'user.delete', 'user', $id);

        return response()->json(['message' => 'User deleted.']);
    }
}
