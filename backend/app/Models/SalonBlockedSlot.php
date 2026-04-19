<?php

namespace App\Models;

use App\Enums\BlockedSlotKind;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalonBlockedSlot extends Model
{
    protected $table = 'salon_blocked_slots';

    protected $fillable = [
        'shop_id',
        'salon_staff_id',
        'starts_at',
        'ends_at',
        'kind',
        'reason',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'starts_at' => 'datetime',
            'ends_at' => 'datetime',
            'kind' => BlockedSlotKind::class,
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }

    public function staff(): BelongsTo
    {
        return $this->belongsTo(SalonStaff::class, 'salon_staff_id');
    }
}
