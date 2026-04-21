<?php

namespace App\Http\Controllers\Api\Salon;

use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Models\SalonPayment;
use App\Models\Shop;
use App\Models\User;
use App\Enums\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OwnerSalonPaymentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $this->assertNotBarber($request);

        $validated = $request->validate([
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:5', 'max:50'],
            'status' => ['sometimes', 'string', 'max:32'],
            'method' => ['sometimes', 'string', 'max:32'],
            'from' => ['sometimes', 'date'],
            'to' => ['sometimes', 'date'],
        ]);

        $perPage = (int) ($validated['per_page'] ?? 20);
        $q = SalonPayment::query()
            ->where('shop_id', $shop->id)
            ->with(['booking:id,customer_name,customer_mobile,starts_at'])
            ->orderByDesc('id');

        if (! empty($validated['status'])) {
            $q->where('status', $validated['status']);
        }
        if (! empty($validated['method'])) {
            $q->where('method', $validated['method']);
        }
        if (! empty($validated['from'])) {
            $q->whereDate('created_at', '>=', $validated['from']);
        }
        if (! empty($validated['to'])) {
            $q->whereDate('created_at', '<=', $validated['to']);
        }

        $paginator = $q->paginate($perPage);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $shop = $this->shop($request);
        $this->assertNotBarber($request);

        $data = $request->validate([
            'amount_cents' => ['required', 'integer', 'min:1', 'max:100000000'],
            'method' => ['required', 'string', 'max:32'],
            'currency' => ['nullable', 'string', 'max:8'],
            'salon_booking_id' => ['nullable', 'integer', 'exists:salon_bookings,id'],
            'transaction_id' => ['nullable', 'string', 'max:191'],
            'status' => ['nullable', 'string', 'in:pending,completed,failed'],
        ]);

        if (isset($data['salon_booking_id'])) {
            $booking = SalonBooking::query()->where('id', $data['salon_booking_id'])->where('shop_id', $shop->id)->first();
            if ($booking === null) {
                return response()->json(['message' => 'Booking not found for this shop.'], 422);
            }
        }

        $payment = SalonPayment::query()->create([
            'shop_id' => $shop->id,
            'salon_booking_id' => $data['salon_booking_id'] ?? null,
            'method' => $data['method'],
            'amount_cents' => $data['amount_cents'],
            'currency' => $data['currency'] ?? 'BDT',
            'transaction_id' => $data['transaction_id'] ?? null,
            'status' => $data['status'] ?? 'completed',
            'metadata' => ['source' => 'manual_entry'],
        ]);

        return response()->json(['data' => $payment->load(['booking:id,customer_name,customer_mobile,starts_at'])], 201);
    }

    public function refund(Request $request, SalonPayment $payment): JsonResponse
    {
        $shop = $this->shop($request);
        $this->assertNotBarber($request);

        if ((int) $payment->shop_id !== (int) $shop->id) {
            abort(404);
        }

        if ($payment->status === 'refunded') {
            return response()->json(['message' => 'Already refunded.'], 422);
        }

        $payment->status = 'refunded';
        $payment->save();

        return response()->json(['data' => $payment->fresh(['booking:id,customer_name,customer_mobile,starts_at'])]);
    }

    private function assertNotBarber(Request $request): void
    {
        $user = $request->user();
        if ($user instanceof User && $user->role === UserRole::Barber) {
            abort(403, 'Staff accounts cannot manage shop payments.');
        }
    }

    private function shop(Request $request): Shop
    {
        $user = $request->user();
        if (! $user instanceof User) {
            abort(401);
        }
        $shop = $user->resolveManagementShop($request);
        if ($shop === null) {
            abort(403, 'No shop.');
        }

        return $shop;
    }
}
