<?php

namespace App\Services;

use App\Models\RefreshToken;
use App\Models\User;
use DateTimeImmutable;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Str;

class JwtTokenService
{
    public function issueAccessToken(User $user): string
    {
        $now = new DateTimeImmutable;
        $ttlMinutes = max(1, (int) config('jwt.access_ttl_minutes', 10080));
        $exp = $now->modify("+{$ttlMinutes} minutes");

        $payload = [
            'iss' => config('app.url'),
            'sub' => (string) $user->getAuthIdentifier(),
            'iat' => $now->getTimestamp(),
            'nbf' => $now->getTimestamp(),
            'exp' => $exp->getTimestamp(),
            'typ' => 'access',
        ];

        return JWT::encode($payload, $this->signingMaterial(), 'HS256');
    }

    /**
     * @return array{0: string, 1: RefreshToken} Plain refresh token and persisted row.
     */
    public function issueRefreshToken(User $user): array
    {
        $plain = Str::random(64);
        $hash = hash('sha256', $plain);

        $days = max(1, (int) config('jwt.refresh_ttl_days', 30));
        $expiresAt = now()->addDays($days);

        $row = RefreshToken::query()->create([
            'user_id' => $user->getAuthIdentifier(),
            'token_hash' => $hash,
            'expires_at' => $expiresAt,
        ]);

        return [$plain, $row];
    }

    /**
     * @return array{user: User, access_token: string, refresh_token: string}|null
     */
    public function exchangeRefreshToken(string $plainRefreshToken): ?array
    {
        if ($plainRefreshToken === '') {
            return null;
        }

        $hash = hash('sha256', $plainRefreshToken);

        $row = RefreshToken::query()->where('token_hash', $hash)->first();
        if (! $row || ! $row->isValid()) {
            return null;
        }

        $user = $row->user;
        if (! $user) {
            return null;
        }

        $row->forceFill(['revoked_at' => now()])->save();

        $access = $this->issueAccessToken($user);
        [$newPlain] = $this->issueRefreshToken($user);

        return [
            'user' => $user,
            'access_token' => $access,
            'refresh_token' => $newPlain,
        ];
    }

    public function userFromAccessToken(string $jwt): ?User
    {
        try {
            $decoded = JWT::decode($jwt, new Key($this->signingMaterial(), 'HS256'));
        } catch (\Throwable) {
            return null;
        }

        if (($decoded->typ ?? null) !== 'access') {
            return null;
        }

        $sub = $decoded->sub ?? null;
        if ($sub === null || $sub === '') {
            return null;
        }

        return User::query()->find((int) $sub);
    }

    public function revokeRefreshToken(string $plainRefreshToken): void
    {
        $hash = hash('sha256', $plainRefreshToken);
        RefreshToken::query()
            ->where('token_hash', $hash)
            ->update(['revoked_at' => now()]);
    }

    public function revokeAllRefreshTokensForUser(User $user): void
    {
        RefreshToken::query()
            ->where('user_id', $user->getAuthIdentifier())
            ->whereNull('revoked_at')
            ->update(['revoked_at' => now()]);
    }

    private function signingMaterial(): string
    {
        $secret = config('jwt.secret');
        if (is_string($secret) && $secret !== '') {
            return $secret;
        }

        $key = (string) config('app.key');
        if (str_starts_with($key, 'base64:')) {
            $decoded = base64_decode(substr($key, 7), true);

            return is_string($decoded) && $decoded !== '' ? $decoded : $key;
        }

        return $key;
    }
}
