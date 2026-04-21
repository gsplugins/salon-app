<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationTemplate extends Model
{
    protected $fillable = [
        'template_key',
        'channel',
        'subject',
        'body',
        'is_active',
    ];

    /**
     * @return array<string, bool>
     */
    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }
}
