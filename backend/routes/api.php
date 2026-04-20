<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CustomerPortalController;
use App\Http\Controllers\Api\PublicBarberProfileController;
use App\Http\Controllers\Api\PublicShopDirectoryController;
use App\Http\Controllers\Api\PublicShopQueueController;
use App\Http\Controllers\Api\Salon\AdminSalonBlockedSlotController;
use App\Http\Controllers\Api\Salon\AdminSalonBookingController;
use App\Http\Controllers\Api\Salon\BarberServiceCatalogController;
use App\Http\Controllers\Api\Salon\BarberShopProfileController;
use App\Http\Controllers\Api\Salon\BarberStaffCatalogController;
use App\Http\Controllers\Api\Salon\BarberStaffPortalController;
use App\Http\Controllers\Api\Salon\OwnerAnalyticsController;
use App\Http\Controllers\Api\Salon\OwnerBranchesController;
use App\Http\Controllers\Api\Salon\OwnerInventoryController;
use App\Http\Controllers\Api\Salon\OwnerQueueController;
use App\Http\Controllers\Api\Salon\OwnerReviewController;
use App\Http\Controllers\Api\Salon\PublicSalonController;
use App\Http\Controllers\Api\Salon\StaffSelfProfileController;
use App\Http\Controllers\Api\SystemSuperAdminController;
use Illuminate\Support\Facades\Route;

Route::get('/test', function () {
    return response()->json([
        'message' => 'Laravel API working 🚀',
    ]);
});

Route::prefix('auth')->middleware('throttle:30,1')->group(function (): void {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('register-barber', [AuthController::class, 'registerBarber']);
    Route::post('login', [AuthController::class, 'login']);
    Route::post('refresh', [AuthController::class, 'refresh']);
    Route::post('forgot-password', [AuthController::class, 'forgotPassword'])
        ->middleware('throttle:5,1');
    Route::post('reset-password', [AuthController::class, 'resetPassword']);

    Route::post('logout', [AuthController::class, 'logout'])->middleware('auth.jwt');
    Route::get('me', [AuthController::class, 'me'])->middleware('auth.jwt');
});

Route::prefix('public')->middleware('throttle:120,1')->group(function (): void {
    Route::get('shops', [PublicShopDirectoryController::class, 'index']);
    Route::get('shops/{shopId}', [PublicShopDirectoryController::class, 'show'])->whereNumber('shopId');
    Route::get('barbers/{staffId}', [PublicBarberProfileController::class, 'show'])->whereNumber('staffId');
    Route::get('shops/{shopId}/queue', [PublicShopQueueController::class, 'index'])->whereNumber('shopId');
    Route::post('shops/{shopId}/queue/join', [PublicShopQueueController::class, 'join'])->whereNumber('shopId');
});

Route::middleware(['auth.jwt', 'customer'])->prefix('me')->group(function (): void {
    Route::get('appointments', [CustomerPortalController::class, 'appointments']);
    Route::get('loyalty', [CustomerPortalController::class, 'loyalty']);
    Route::patch('bookings/{booking}', [CustomerPortalController::class, 'updateBooking'])->whereNumber('booking');
});

Route::prefix('shops/{shop:slug}')->middleware(['throttle:120,1', 'auth.jwt.optional'])->group(function (): void {
    Route::get('meta', [PublicSalonController::class, 'shopMeta']);
    Route::get('services', [PublicSalonController::class, 'services']);
    Route::get('staff', [PublicSalonController::class, 'staff']);
    Route::get('availability', [PublicSalonController::class, 'availability']);
    Route::post('bookings', [PublicSalonController::class, 'storeBooking']);
});

Route::middleware(['auth.jwt', 'barber', 'subscription'])->prefix('my/shop')->group(function (): void {
    Route::get('profile', [BarberShopProfileController::class, 'show']);
    Route::patch('profile', [BarberShopProfileController::class, 'update']);
    Route::get('stats', [BarberShopProfileController::class, 'stats']);
    Route::get('clients', [BarberShopProfileController::class, 'clients']);

    Route::get('services-catalog', [BarberServiceCatalogController::class, 'index']);
    Route::post('services-catalog', [BarberServiceCatalogController::class, 'store']);
    Route::patch('services-catalog/{serviceId}', [BarberServiceCatalogController::class, 'update'])->whereNumber('serviceId');
    Route::delete('services-catalog/{serviceId}', [BarberServiceCatalogController::class, 'destroy'])->whereNumber('serviceId');

    Route::get('staff-catalog', [BarberStaffCatalogController::class, 'index']);
    Route::post('staff-catalog', [BarberStaffCatalogController::class, 'store']);
    Route::patch('staff-catalog/{staffId}', [BarberStaffCatalogController::class, 'update'])->whereNumber('staffId');
    Route::delete('staff-catalog/{staffId}', [BarberStaffCatalogController::class, 'destroy'])->whereNumber('staffId');

    Route::get('bookings', [AdminSalonBookingController::class, 'index']);
    Route::post('bookings', [AdminSalonBookingController::class, 'store']);
    Route::patch('bookings/{booking}', [AdminSalonBookingController::class, 'update']);
    Route::get('blocked-slots', [AdminSalonBlockedSlotController::class, 'index']);
    Route::post('blocked-slots', [AdminSalonBlockedSlotController::class, 'store']);
    Route::delete('blocked-slots/{id}', [AdminSalonBlockedSlotController::class, 'destroy']);

    Route::get('branches', [OwnerBranchesController::class, 'index']);

    Route::get('inventory', [OwnerInventoryController::class, 'index']);
    Route::post('inventory', [OwnerInventoryController::class, 'store']);
    Route::patch('inventory/{id}', [OwnerInventoryController::class, 'update'])->whereNumber('id');
    Route::delete('inventory/{id}', [OwnerInventoryController::class, 'destroy'])->whereNumber('id');

    Route::get('reviews', [OwnerReviewController::class, 'index']);
    Route::patch('reviews/{reviewId}', [OwnerReviewController::class, 'updateReply'])->whereNumber('reviewId');

    Route::get('analytics/summary', [OwnerAnalyticsController::class, 'summary']);

    Route::get('queue/manage', [OwnerQueueController::class, 'index']);
    Route::patch('queue/{id}/status', [OwnerQueueController::class, 'updateStatus'])->whereNumber('id');
});

Route::middleware(['auth.jwt', 'shop_owner', 'subscription'])->prefix('my/shop')->group(function (): void {
    Route::post('branches', [OwnerBranchesController::class, 'store']);
    Route::patch('branches/{shopId}', [OwnerBranchesController::class, 'update'])->whereNumber('shopId');
    Route::post('staff-with-account', [BarberStaffCatalogController::class, 'storeWithAccount']);
});

Route::middleware(['auth.jwt', 'staff_barber', 'subscription'])->prefix('my/barber')->group(function (): void {
    Route::get('today', [BarberStaffPortalController::class, 'today']);
    Route::get('history', [BarberStaffPortalController::class, 'history']);
    Route::get('profile', [StaffSelfProfileController::class, 'show']);
    Route::patch('profile', [StaffSelfProfileController::class, 'update']);
});

Route::middleware(['auth.jwt', 'super_admin'])->prefix('system')->group(function (): void {
    Route::get('shops', [SystemSuperAdminController::class, 'shops']);
    Route::post('shops', [SystemSuperAdminController::class, 'storeShop']);
    Route::patch('shops/{id}', [SystemSuperAdminController::class, 'updateShop'])->whereNumber('id');
    Route::delete('shops/{id}', [SystemSuperAdminController::class, 'destroyShop'])->whereNumber('id');

    Route::get('users', [SystemSuperAdminController::class, 'users']);
    Route::patch('users/{user}', [SystemSuperAdminController::class, 'updateUser']);
    Route::post('users/{user}/reset-password', [SystemSuperAdminController::class, 'resetUserPassword']);

    Route::post('subscriptions/{subscription}/extend', [SystemSuperAdminController::class, 'extendSubscription']);
    Route::patch('subscriptions/{subscription}', [SystemSuperAdminController::class, 'updateSubscription']);

    Route::get('bkash-payments', [SystemSuperAdminController::class, 'bkashPayments']);
    Route::post('bkash-payments', [SystemSuperAdminController::class, 'storeBkashPayment']);
});
