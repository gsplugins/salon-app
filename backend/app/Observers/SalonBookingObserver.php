<?php

namespace App\Observers;

use App\Enums\BookingStatus;
use App\Models\SalonBooking;
use App\Models\StaffNotification;
use App\Services\Sms\SmsSender;
use App\Support\MobileNormalizer;
use Illuminate\Support\Facades\Schema;

class SalonBookingObserver
{
    public function __construct(
        private readonly SmsSender $sms
    ) {}

    public function created(SalonBooking $booking): void
    {
        $this->notifyIfMobile($booking, $booking->status);
        $when = $booking->starts_at->timezone(config('app.timezone'))->format('D M j, g:i A');
        $this->notifyStaffInbox(
            $booking,
            'booking_assigned',
            'New appointment',
            "{$booking->customer_name} booked you for {$when}. Open your staff appointments to manage it."
        );
    }

    public function updated(SalonBooking $booking): void
    {
        if ($booking->wasChanged('status')) {
            /** @var BookingStatus $status */
            $status = $booking->status;
            $this->notifyIfMobile($booking, $status);
            if ($status === BookingStatus::Cancelled) {
                $this->notifyStaffInbox(
                    $booking,
                    'booking_cancelled',
                    'Appointment cancelled',
                    "The booking for {$booking->customer_name} was cancelled."
                );
            }
            if ($status === BookingStatus::Confirmed) {
                $when = $booking->starts_at->timezone(config('app.timezone'))->format('D M j, g:i A');
                $this->notifyStaffInbox(
                    $booking,
                    'booking_confirmed',
                    'Booking confirmed',
                    "{$booking->customer_name} is confirmed for {$when}."
                );
            }
        }

        if ($booking->wasChanged('starts_at') || $booking->wasChanged('salon_staff_id')) {
            $this->notifyStaffInbox(
                $booking,
                'booking_updated',
                'Appointment updated',
                "A booking for {$booking->customer_name} had a time or assignment change."
            );
        }
    }

    private function notifyStaffInbox(SalonBooking $booking, string $type, string $title, string $body): void
    {
        if (! Schema::hasTable('staff_notifications')) {
            return;
        }
        $staffId = $booking->salon_staff_id;
        if ($staffId === null) {
            return;
        }

        StaffNotification::query()->create([
            'salon_staff_id' => $staffId,
            'shop_id' => $booking->shop_id,
            'type' => $type,
            'title' => $title,
            'body' => $body,
            'metadata' => [
                'booking_id' => $booking->id,
                'starts_at' => $booking->starts_at?->toIso8601String(),
            ],
            'is_read' => false,
        ]);
    }

    private function notifyIfMobile(SalonBooking $booking, BookingStatus $status): void
    {
        $mobile = MobileNormalizer::normalize($booking->customer_mobile);
        if ($mobile === '') {
            return;
        }

        $msg = $this->messageForStatus($booking, $status);
        if ($msg === null) {
            return;
        }

        $this->sms->send($mobile, $msg);
    }

    private function messageForStatus(SalonBooking $booking, BookingStatus $status): ?string
    {
        $name = $booking->customer_name;
        $when = $booking->starts_at->timezone(config('app.timezone'))->format('D M j, g:i A');

        return match ($status) {
            BookingStatus::Pending => "Hi {$name}, your booking request for {$when} is pending confirmation. We'll notify you when it's confirmed.",
            BookingStatus::Confirmed => "Hi {$name}, your appointment is confirmed for {$when}. See you at the salon.",
            BookingStatus::Completed => "Hi {$name}, thanks for visiting. Your appointment on {$when} is marked completed.",
            BookingStatus::Cancelled => "Hi {$name}, your appointment on {$when} has been cancelled.",
            BookingStatus::NoShow => "Hi {$name}, your appointment on {$when} was marked as no-show. Call us if you'd like to reschedule.",
        };
    }
}
