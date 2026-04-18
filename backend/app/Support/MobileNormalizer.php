<?php

namespace App\Support;

final class MobileNormalizer
{
    /**
     * Store and compare mobiles as digits only (no spaces or symbols).
     */
    public static function normalize(string $mobile): string
    {
        return preg_replace('/\D+/', '', $mobile) ?? '';
    }
}
