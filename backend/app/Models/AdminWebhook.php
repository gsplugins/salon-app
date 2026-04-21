<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AdminWebhook extends Model
{
    protected $fillable = [
        'url',
        'secret',
        'events',
        'is_active',
    ];

    /**
     * @return array<string, mixed>
     */
    protected function casts(): array
    {
        return [
            'events' => 'array',
            'is_active' => 'boolean',
        ];
    }
}
