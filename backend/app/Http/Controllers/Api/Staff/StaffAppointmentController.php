<?php

namespace App\Http\Controllers\Api\Staff;

use App\Enums\BookingStatus;
use App\Http\Controllers\Controller;
use App\Models\SalonBooking;
use App\Support\SalonBookingPresenter;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class StaffAppointmentController extends Controller
{
    use ResolvesStaffProfile;

    public function index(Request $request): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
            'status' => ['nullable', 'string', Rule::in(BookingStatus::values())],
        ]);

        $tz = config('app.timezone');
        $from = isset($data['from'])
            ? CarbonImmutable::parse($data['from'])->timezone($tz)->startOfDay()
            : now()->timezone($tz)->subDays(7)->startOfDay();
        $to = isset($data['to'])
            ? CarbonImmutable::parse($data['to'])->timezone($tz)->endOfDay()
            : now()->timezone($tz)->addMonths(3)->endOfDay();

        if ($from->gt($to)) {
            throw ValidationException::withMessages([
                'from' => ['The from date must be before or equal to the to date.'],
            ]);
        }

        $q = SalonBooking::query()
            ->where('salon_staff_id', $staff->id)
            ->where('starts_at', '<', $to)
            ->where('ends_at', '>', $from)
            ->with(['service:id,name,category,duration_minutes,price_cents', 'staff:id,name', 'shop:id,name,slug']);

        if (! empty($data['status'])) {
            $st = BookingStatus::tryFrom($data['status']);
            if ($st !== null) {
                $q->where('status', $st);
            }
        }

        $rows = $q->orderBy('starts_at')->limit(500)->get();

        return response()->json([
            'data' => $rows->map(fn (SalonBooking $b) => SalonBookingPresenter::toArray($b))->values(),
        ]);
    }

    public function update(Request $request, SalonBooking $booking): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        if ((int) $booking->salon_staff_id !== (int) $staff->id) {
            abort(403, 'Not your appointment.');
        }

        $data = $request->validate([
            'status' => ['required', 'string', Rule::in(BookingStatus::values())],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $next = BookingStatus::tryFrom($data['status']);
        if ($next === null) {
            return response()->json(['message' => 'Invalid status.'], 422);
        }
        if (! in_array($next, [BookingStatus::Completed, BookingStatus::NoShow], true)) {
            return response()->json(['message' => 'Staff can only mark appointments completed or no-show.'], 422);
        }

        $booking->status = $next;
        if (array_key_exists('notes', $data)) {
            $booking->notes = $data['notes'];
        }
        $booking->save();

        return response()->json(['data' => SalonBookingPresenter::toArray($booking->fresh())]);
    }

    public function rescheduleRequest(Request $request, SalonBooking $booking): JsonResponse
    {
        $staff = $this->staffFromRequest($request);
        if ((int) $booking->salon_staff_id !== (int) $staff->id) {
            abort(403, 'Not your appointment.');
        }

        $data = $request->validate([
            'message' => ['required', 'string', 'max:2000'],
            'suggested_starts_at' => ['nullable', 'date'],
        ]);

        $stamp = now()->timezone(config('app.timezone'))->toIso8601String();
        $line = "\n[STAFF_RESCHEDULE_REQUEST {$stamp}] ".$data['message'];
        if (! empty($data['suggested_starts_at'])) {
            $line .= ' Suggested: '.$data['suggested_starts_at'];
        }
        $booking->notes = trim((string) $booking->notes).$line;
        $booking->save();

        return response()->json(['data' => SalonBookingPresenter::toArray($booking->fresh())]);
    }
}
