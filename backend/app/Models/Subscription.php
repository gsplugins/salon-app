<?php

namespace App\Models;

use App\Enums\SubscriptionStatus;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Subscription extends Model
{
    protected $fillable = [
        'shop_id',
        'subscription_plan_id',
        'plan_key',
        'status',
        'trial_ends_at',
        'current_period_end',
        'stripe_customer_id',
        'stripe_subscription_id',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'status' => SubscriptionStatus::class,
            'trial_ends_at' => 'datetime',
            'current_period_end' => 'datetime',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    /**
     * @return BelongsTo<SubscriptionPlan, self>
     */
    public function plan(): BelongsTo
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }

    public function allowsAppAccess(): bool
    {
        if (! $this->status instanceof SubscriptionStatus) {
            return false;
        }

        return $this->status->allowsAppAccess();
    }
}
