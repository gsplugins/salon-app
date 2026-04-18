<?php

return [

    /*
    |--------------------------------------------------------------------------
    | SMS driver
    |--------------------------------------------------------------------------
    |
    | "log" — writes SMS body to the application log (development).
    | Add your gateway (e.g. Twilio) later behind the same interface.
    |
    */

    'driver' => env('SMS_DRIVER', 'log'),

];
