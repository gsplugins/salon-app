<?php

use App\Http\Controllers\Api\AuthController;
use Illuminate\Support\Facades\Route;

Route::get('/test', function () {
    return response()->json([
        'message' => 'Laravel API working 🚀',
    ]);
});

Route::prefix('auth')->group(function (): void {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('refresh', [AuthController::class, 'refresh']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])
        ->middleware('throttle:5,1');
    Route::post('reset-password', [AuthController::class, 'resetPassword']);

    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth.jwt');
    Route::get('me', [AuthController::class, 'me'])->middleware('auth.jwt');
});
