<?php

namespace App\Observers;

use App\Enums\BookingStatus;
use App\Models\SalonBooking;
use App\Services\Sms\SmsSender;
use App\Support\MobileNormalizer;

class SalonBookingObserver
{
    public function __construct(
        private readonly SmsSender $sms
    ) {}

    public function created(SalonBooking $booking): void
    {
        $this->notifyIfMobile($booking, $booking->status);
    }

    public function updated(SalonBooking $booking): void
    {
        if (! $booking->wasChanged('status')) {
            return;
        }

        /** @var BookingStatus $status */
        $status = $booking->status;
        $this->notifyIfMobile($booking, $status);
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
