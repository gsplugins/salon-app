<?php

namespace App\Support;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\Request;

final class AdminAudit
{
    /**
     * @param  array<string, mixed>|null  $metadata
     */
    public static function record(
        ?User $actor,
        Request $request,
        string $action,
        ?string $targetType = null,
        ?int $targetId = null,
        ?array $metadata = null
    ): void {
        AuditLog::query()->create([
            'admin_user_id' => $actor?->id,
            'action' => $action,
            'target_type' => $targetType,
            'target_id' => $targetId,
            'ip' => $request->ip(),
            'user_agent' => mb_substr((string) $request->userAgent(), 0, 2000),
            'metadata' => $metadata,
        ]);
    }
}
