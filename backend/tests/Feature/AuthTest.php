<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Sms\SmsSender;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    public function test_register_login_me_refresh_logout_flow(): void
    {
        $register = $this->postJson('/api/auth/register', [
            'mobile' => '+1 (503) 555-0100',
            'password' => 'secret-pass',
            'password_confirmation' => 'secret-pass',
            'name' => 'Alex',
        ]);

        $register->assertCreated()
            ->assertJsonStructure(['access_token', 'token_type', 'expires_in', 'refresh_token']);

        $access = $register->json('access_token');
        $refresh = $register->json('refresh_token');

        $this->getJson('/api/auth/me', [
            'Authorization' => 'Bearer '.$access,
        ])->assertOk()
            ->assertJsonPath('mobile', '15035550100')
            ->assertJsonPath('name', 'Alex');

        $refreshRes = $this->postJson('/api/auth/refresh', [
            'refresh_token' => $refresh,
        ]);

        $refreshRes->assertOk()->assertJsonStructure(['access_token', 'refresh_token']);

        $newRefresh = $refreshRes->json('refresh_token');

        $this->postJson('/api/auth/logout', [
            'refresh_token' => $newRefresh,
        ], [
            'Authorization' => 'Bearer '.$refreshRes->json('access_token'),
        ])->assertOk();

        $this->postJson('/api/auth/refresh', [
            'refresh_token' => $newRefresh,
        ])->assertStatus(401);
    }

    public function test_forgot_and_reset_password_with_mock_sms(): void
    {
        $bag = new \stdClass;
        $bag->message = null;

        $mock = new class($bag) implements SmsSender
        {
            public function __construct(private \stdClass $bag) {}

            public function send(string $mobile, string $message): void
            {
                $this->bag->message = $message;
            }
        };

        $this->app->instance(SmsSender::class, $mock);

        User::factory()->create([
            'mobile' => '5035550199',
            'password' => 'old-secret-pass',
        ]);

        $this->postJson('/api/auth/forgot-password', [
            'mobile' => '(503) 555-0199',
        ])->assertOk();

        $this->assertIsString($bag->message);
        preg_match('/(\d{6})/', $bag->message, $m);
        $this->assertArrayHasKey(1, $m);
        $otp = $m[1];

        $this->postJson('/api/auth/reset-password', [
            'mobile' => '5035550199',
            'otp' => $otp,
            'password' => 'new-secret-pass',
            'password_confirmation' => 'new-secret-pass',
        ])->assertOk();

        $this->postJson('/api/auth/login', [
            'mobile' => '5035550199',
            'password' => 'new-secret-pass',
        ])->assertOk();
    }
}
