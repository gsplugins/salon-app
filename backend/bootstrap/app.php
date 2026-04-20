<?php

use App\Http\Middleware\AuthenticateJwt;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'auth.jwt' => AuthenticateJwt::class,
            'auth.jwt.optional' => \App\Http\Middleware\OptionalAuthenticateJwt::class,
            'super_admin' => \App\Http\Middleware\EnsureSuperAdmin::class,
            'barber' => \App\Http\Middleware\EnsureBarber::class,
            'shop_owner' => \App\Http\Middleware\EnsureShopOwner::class,
            'customer' => \App\Http\Middleware\EnsureCustomer::class,
            'staff_barber' => \App\Http\Middleware\EnsureStaffBarber::class,
            'subscription' => \App\Http\Middleware\EnsureBarberSubscriptionActive::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        //
    })->create();
