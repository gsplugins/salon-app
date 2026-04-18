<?php

namespace App\Services\Sms;

interface SmsSender
{
    public function send(string $mobile, string $message): void;
}
