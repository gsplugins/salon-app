<?php

namespace App\Http\Middleware;

use App\Services\JwtTokenService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Attaches the authenticated user when a valid Bearer token is present.
 * Does not fail when the token is missing; invalid/expired tokens are ignored (guest).
 */
class OptionalAuthenticateJwt
{
    public function __construct(
        private readonly JwtTokenService $tokens
    ) {}

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();
        if (! is_string($token) || $token === '') {
            return $next($request);
        }

        $user = $this->tokens->userFromAccessToken($token);
        if ($user !== null && ! $user->is_locked) {
            $request->setUserResolver(static fn () => $user);
        }

        return $next($request);
    }
}
