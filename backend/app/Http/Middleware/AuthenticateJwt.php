<?php

namespace App\Http\Middleware;

use App\Services\JwtTokenService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateJwt
{
    public function __construct(
        private readonly JwtTokenService $tokens
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if (! is_string($token) || $token === '') {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $user = $this->tokens->userFromAccessToken($token);
        if (! $user) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        $request->setUserResolver(static fn () => $user);

        return $next($request);
    }
}
