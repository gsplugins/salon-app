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
use App\Http\Controllers\Api\Salon\OwnerSalonPaymentController;
use App\Http\Controllers\Api\Salon\PublicSalonController;
use App\Http\Controllers\Api\Salon\StaffSelfProfileController;
use App\Http\Controllers\Api\Staff\StaffAppointmentController;
use App\Http\Controllers\Api\Staff\StaffAvailabilityController;
use App\Http\Controllers\Api\Staff\StaffCustomerController;
use App\Http\Controllers\Api\Staff\StaffDashboardController;
use App\Http\Controllers\Api\Staff\StaffEarningsController;
use App\Http\Controllers\Api\Staff\StaffLeaveRequestController;
use App\Http\Controllers\Api\Staff\StaffNotificationController;
use App\Http\Controllers\Api\Staff\StaffReviewController;
use App\Http\Controllers\Api\Staff\StaffScheduleController;
use App\Http\Controllers\Api\Staff\StaffServiceController;
use App\Http\Controllers\Api\Admin\AdminAnalyticsController;
use App\Http\Controllers\Api\Admin\AdminAuditLogController;
use App\Http\Controllers\Api\Admin\AdminBillingController;
use App\Http\Controllers\Api\Admin\AdminGeneralController;
use App\Http\Controllers\Api\Admin\AdminIntegrationController;
use App\Http\Controllers\Api\Admin\AdminNotificationController;
use App\Http\Controllers\Api\Admin\AdminPermissionsController;
use App\Http\Controllers\Api\Admin\AdminShopSubscriptionController;
use App\Http\Controllers\Api\Admin\AdminSubscriptionPlanController;
use App\Http\Controllers\Api\Admin\AdminUserActionsController;
use App\Http\Controllers\Api\Admin\AdminWebhookController;
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
    Route::post('change-password', [AuthController::class, 'changePassword'])->middleware('auth.jwt');
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

    Route::get('payments', [OwnerSalonPaymentController::class, 'index']);
    Route::post('payments', [OwnerSalonPaymentController::class, 'store']);
    Route::patch('payments/{payment}/refund', [OwnerSalonPaymentController::class, 'refund'])->whereNumber('payment');

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

Route::middleware(['auth.jwt', 'staff_barber', 'subscription'])->prefix('staff')->group(function (): void {
    Route::get('dashboard', [StaffDashboardController::class, 'show']);
    Route::get('appointments', [StaffAppointmentController::class, 'index']);
    Route::patch('appointments/{booking}', [StaffAppointmentController::class, 'update'])->whereNumber('booking');
    Route::post('appointments/{booking}/reschedule-request', [StaffAppointmentController::class, 'rescheduleRequest'])->whereNumber('booking');

    Route::get('schedule', [StaffScheduleController::class, 'show']);
    Route::get('leave-requests', [StaffLeaveRequestController::class, 'index']);
    Route::post('leave-requests', [StaffLeaveRequestController::class, 'store']);

    Route::get('customers', [StaffCustomerController::class, 'index']);
    Route::get('customers/{mobile}/history', [StaffCustomerController::class, 'history']);
    Route::get('customers/{mobile}/notes', [StaffCustomerController::class, 'notes']);
    Route::post('customer-notes', [StaffCustomerController::class, 'storeNote']);

    Route::get('services', [StaffServiceController::class, 'index']);
    Route::get('earnings/summary', [StaffEarningsController::class, 'summary']);

    Route::get('notifications', [StaffNotificationController::class, 'index']);
    Route::patch('notifications/{notification}/read', [StaffNotificationController::class, 'markRead'])->whereNumber('notification');
    Route::post('notifications/read-all', [StaffNotificationController::class, 'markAllRead']);
    Route::delete('notifications', [StaffNotificationController::class, 'destroyAll']);
    Route::patch('notification-preferences', [StaffNotificationController::class, 'updatePreferences']);

    Route::get('availability', [StaffAvailabilityController::class, 'show']);
    Route::patch('availability', [StaffAvailabilityController::class, 'updateStatus']);
    Route::get('availability/blocks', [StaffAvailabilityController::class, 'blocks']);
    Route::post('availability/blocks', [StaffAvailabilityController::class, 'storeBlock']);
    Route::delete('availability/blocks/{block}', [StaffAvailabilityController::class, 'destroyBlock'])->whereNumber('block');

    Route::get('reviews', [StaffReviewController::class, 'index']);

    Route::get('profile', [StaffSelfProfileController::class, 'show']);
    Route::patch('profile', [StaffSelfProfileController::class, 'update']);
});

Route::middleware(['auth.jwt', 'super_admin'])->prefix('admin')->group(function (): void {
    Route::get('general', [AdminGeneralController::class, 'show']);
    Route::patch('general', [AdminGeneralController::class, 'update']);

    Route::get('subscription-plans', [AdminSubscriptionPlanController::class, 'index']);
    Route::post('subscription-plans', [AdminSubscriptionPlanController::class, 'store']);
    Route::patch('subscription-plans/{plan}', [AdminSubscriptionPlanController::class, 'update']);
    Route::delete('subscription-plans/{plan}', [AdminSubscriptionPlanController::class, 'destroy']);

    Route::patch('shops/{shop}/subscription', [AdminShopSubscriptionController::class, 'updateForShop']);

    Route::get('audit-logs', [AdminAuditLogController::class, 'index']);
    Route::get('audit-logs/export', [AdminAuditLogController::class, 'exportCsv']);

    Route::get('notification-templates', [AdminNotificationController::class, 'templates']);
    Route::patch('notification-templates/{template}', [AdminNotificationController::class, 'updateTemplate']);
    Route::patch('notification-toggles', [AdminNotificationController::class, 'updateGlobalToggles']);
    Route::patch('integrations/smtp', [AdminNotificationController::class, 'updateSmtp']);
    Route::patch('integrations/sms', [AdminNotificationController::class, 'updateSms']);

    Route::get('integrations', [AdminIntegrationController::class, 'show']);
    Route::patch('integrations/stripe', [AdminIntegrationController::class, 'updateStripe']);
    Route::patch('integrations/google-calendar', [AdminIntegrationController::class, 'updateGoogleCalendar']);
    Route::patch('integrations/whatsapp', [AdminIntegrationController::class, 'updateWhatsapp']);

    Route::get('webhooks', [AdminWebhookController::class, 'index']);
    Route::post('webhooks', [AdminWebhookController::class, 'store']);
    Route::patch('webhooks/{webhook}', [AdminWebhookController::class, 'update']);
    Route::delete('webhooks/{webhook}', [AdminWebhookController::class, 'destroy']);
    Route::post('webhooks/{webhook}/test', [AdminWebhookController::class, 'test']);

    Route::get('billing/bkash', [AdminBillingController::class, 'bkashIndex']);
    Route::get('billing/salon-payments', [AdminBillingController::class, 'salonPaymentsIndex']);
    Route::patch('billing/bkash/{payment}/refund', [AdminBillingController::class, 'refundBkash']);
    Route::patch('billing/salon-payments/{salon_payment}/refund', [AdminBillingController::class, 'refundSalonPayment']);
    Route::get('billing/salon-payments/{salon_payment}/invoice', [AdminBillingController::class, 'invoiceSalonPayment']);

    Route::get('analytics/summary', [AdminAnalyticsController::class, 'summary']);
    Route::get('analytics/signups', [AdminAnalyticsController::class, 'signupsSeries']);

    Route::get('permissions', [AdminPermissionsController::class, 'show']);
    Route::put('permissions', [AdminPermissionsController::class, 'update']);

    Route::post('users/{user}/impersonate', [AdminUserActionsController::class, 'impersonate']);
    Route::delete('users/{user}', [AdminUserActionsController::class, 'destroy']);
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
