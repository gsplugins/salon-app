<?php

namespace App\Services\Sms;

use Illuminate\Support\Facades\Log;

final class LogSmsSender implements SmsSender
{
    public function send(string $mobile, string $message): void
    {
        Log::info('SMS (log driver)', [
            'mobile' => $mobile,
            'message' => $message,
        ]);
    }
}
