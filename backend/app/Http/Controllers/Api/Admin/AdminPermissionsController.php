<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\PlatformSetting;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminPermissionsController extends Controller
{
    public function show(): JsonResponse
    {
        $s = PlatformSetting::singleton();

        return response()->json([
            'data' => [
                'matrix' => $this->defaultMatrix(),
                'overrides' => $s->role_permissions,
            ],
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $data = $request->validate([
            'role_permissions' => ['required', 'array'],
        ]);

        $s = PlatformSetting::singleton();
        $s->role_permissions = $data['role_permissions'];
        $s->save();

        AdminAudit::record($request->user(), $request, 'platform.permissions.update', 'platform_settings', (int) $s->id);

        return response()->json(['data' => $s->role_permissions]);
    }

    /**
     * @return array<string, array<string, bool>>
     */
    private function defaultMatrix(): array
    {
        return [
            'super_admin' => [
                'platform' => true,
                'shops' => true,
                'users' => true,
                'billing' => true,
                'settings' => true,
            ],
            'shop_owner' => [
                'platform' => false,
                'shops' => true,
                'users' => true,
                'billing' => true,
                'settings' => true,
            ],
            'manager' => [
                'platform' => false,
                'shops' => true,
                'users' => false,
                'billing' => false,
                'settings' => true,
            ],
            'barber' => [
                'platform' => false,
                'shops' => true,
                'users' => false,
                'billing' => false,
                'settings' => false,
            ],
            'customer' => [
                'platform' => false,
                'shops' => false,
                'users' => false,
                'billing' => false,
                'settings' => false,
            ],
        ];
    }
}
