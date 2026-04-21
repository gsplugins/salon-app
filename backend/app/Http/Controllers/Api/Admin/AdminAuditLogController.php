<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AdminAuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::query()->with('admin:id,name,mobile')->orderByDesc('id');

        if ($request->query('admin_user_id')) {
            $query->where('admin_user_id', (int) $request->query('admin_user_id'));
        }
        if ($request->query('action')) {
            $query->where('action', 'like', '%'.(string) $request->query('action').'%');
        }
        if ($request->query('target_type')) {
            $query->where('target_type', (string) $request->query('target_type'));
        }
        if ($request->query('from')) {
            $query->where('created_at', '>=', (string) $request->query('from'));
        }
        if ($request->query('to')) {
            $query->where('created_at', '<=', (string) $request->query('to'));
        }

        return response()->json($query->paginate(50));
    }

    public function exportCsv(Request $request): StreamedResponse
    {
        $query = AuditLog::query()->with('admin:id,name,mobile')->orderByDesc('id');
        if ($request->query('from')) {
            $query->where('created_at', '>=', (string) $request->query('from'));
        }
        if ($request->query('to')) {
            $query->where('created_at', '<=', (string) $request->query('to'));
        }

        $filename = 'audit-logs-'.now()->format('Y-m-d-His').'.csv';

        return response()->streamDownload(function () use ($query): void {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['id', 'created_at', 'admin_id', 'admin', 'action', 'target_type', 'target_id', 'ip']);
            $query->chunk(500, function ($rows) use ($out): void {
                foreach ($rows as $row) {
                    fputcsv($out, [
                        $row->id,
                        $row->created_at?->toIso8601String(),
                        $row->admin_user_id,
                        $row->admin?->name ?? '',
                        $row->action,
                        $row->target_type,
                        $row->target_id,
                        $row->ip,
                    ]);
                }
            });
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }
}
