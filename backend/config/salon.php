<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Default opening hours (app timezone)
    |--------------------------------------------------------------------------
    | Times are "H:i" strings. Slots are generated from open to last start such
    | that service duration still fits before close.
    */
    'open_time' => env('SALON_OPEN_TIME', '09:00'),
    'close_time' => env('SALON_CLOSE_TIME', '18:00'),
    'slot_step_minutes' => (int) env('SALON_SLOT_STEP_MINUTES', 15),

    /*
    | How far ahead customers can book (days from today).
    */
    'advance_booking_days' => (int) env('SALON_ADVANCE_BOOKING_DAYS', 60),
];
