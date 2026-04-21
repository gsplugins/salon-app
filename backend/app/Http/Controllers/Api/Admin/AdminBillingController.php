<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\BkashPayment;
use App\Models\SalonPayment;
use App\Support\AdminAudit;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminBillingController extends Controller
{
    public function bkashIndex(Request $request): JsonResponse
    {
        $query = BkashPayment::query()->with(['shop:id,name,slug']);

        if ($request->query('shop_id')) {
            $query->where('shop_id', (int) $request->query('shop_id'));
        }
        if ($request->query('status')) {
            $query->where('status', (string) $request->query('status'));
        }
        if ($request->query('from')) {
            $query->where('created_at', '>=', (string) $request->query('from'));
        }
        if ($request->query('to')) {
            $query->where('created_at', '<=', (string) $request->query('to'));
        }

        return response()->json($query->orderByDesc('id')->paginate(30));
    }

    public function salonPaymentsIndex(Request $request): JsonResponse
    {
        $query = SalonPayment::query()->with(['shop:id,name,slug']);

        if ($request->query('shop_id')) {
            $query->where('shop_id', (int) $request->query('shop_id'));
        }
        if ($request->query('status')) {
            $query->where('status', (string) $request->query('status'));
        }
        if ($request->query('from')) {
            $query->where('created_at', '>=', (string) $request->query('from'));
        }
        if ($request->query('to')) {
            $query->where('created_at', '<=', (string) $request->query('to'));
        }

        return response()->json($query->orderByDesc('id')->paginate(30));
    }

    public function refundBkash(Request $request, BkashPayment $payment): JsonResponse
    {
        $payment->status = 'refunded';
        $payment->save();

        AdminAudit::record($request->user(), $request, 'billing.bkash.refund', 'bkash_payment', (int) $payment->id);

        return response()->json(['data' => $payment->fresh(['shop:id,name,slug'])]);
    }

    public function refundSalonPayment(Request $request, SalonPayment $salon_payment): JsonResponse
    {
        $salon_payment->status = 'refunded';
        $salon_payment->save();

        AdminAudit::record($request->user(), $request, 'billing.salon.refund', 'salon_payment', (int) $salon_payment->id);

        return response()->json(['data' => $salon_payment->fresh(['shop:id,name,slug'])]);
    }

    public function invoiceSalonPayment(SalonPayment $salon_payment): JsonResponse
    {
        return response()->json([
            'message' => 'PDF invoice generation is not configured yet. Export payment JSON from the API or add dompdf/snappy.',
            'payment' => $salon_payment->load(['shop:id,name,slug']),
        ], 501);
    }
}
