<?php

namespace App\Enums;

enum SubscriptionStatus: string
{
    case Trialing = 'trialing';
    case Active = 'active';
    case PastDue = 'past_due';
    case Cancelled = 'cancelled';

    public function allowsAppAccess(): bool
    {
        return match ($this) {
            self::Trialing, self::Active => true,
            default => false,
        };
    }
}
