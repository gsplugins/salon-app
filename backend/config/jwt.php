<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Signing secret
    |--------------------------------------------------------------------------
    |
    | HS256 key. Set JWT_SECRET in .env (e.g. 64 hex chars). Falls back to APP_KEY.
    |
    */

    'secret' => env('JWT_SECRET'),

    /*
    |--------------------------------------------------------------------------
    | Access token TTL
    |--------------------------------------------------------------------------
    |
    | Minutes until access JWT expires (default: 7 days).
    |
    */

    'access_ttl_minutes' => (int) env('JWT_ACCESS_TTL_MINUTES', 60 * 24 * 7),

    /*
    |--------------------------------------------------------------------------
    | Refresh token storage TTL
    |--------------------------------------------------------------------------
    |
    | Days until an opaque refresh token row expires (default: 30).
    |
    */

    'refresh_ttl_days' => (int) env('JWT_REFRESH_TTL_DAYS', 30),

];
