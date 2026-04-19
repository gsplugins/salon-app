<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BkashPayment extends Model
{
    protected $fillable = [
        'shop_id',
        'amount_paisa',
        'trx_id',
        'status',
        'payer_mobile',
        'note',
    ];

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }
}
