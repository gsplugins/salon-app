<?php

namespace App\Providers;

use App\Services\Sms\LogSmsSender;
use App\Services\Sms\SmsSender;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(SmsSender::class, function (): SmsSender {
            $driver = config('sms.driver', 'log');

            return match ($driver) {
                default => new LogSmsSender,
            };
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
