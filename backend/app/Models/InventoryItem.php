<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class InventoryItem extends Model
{
    protected $fillable = [
        'shop_id',
        'name',
        'quantity',
        'unit',
        'low_stock_threshold',
    ];

    protected function casts(): array
    {
        return [
            'quantity' => 'decimal:2',
            'low_stock_threshold' => 'decimal:2',
        ];
    }

    public function shop(): BelongsTo
    {
        return $this->belongsTo(Shop::class);
    }
}
