"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Calendar, Check, ChevronLeft, Loader2, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { fetchAuthMe } from "@/lib/auth-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import {
  createPublicBooking,
  fetchAvailability,
  fetchPublicQueue,
  fetchSalonServices,
  fetchSalonStaff,
  fetchShopMeta,
  formatApiError,
  joinWaitlist,
  type AvailabilitySlot,
  type SalonServiceRow,
  type SalonStaffOption,
} from "@/lib/salon-api";

type Step = 1 | 2 | 3 | 4 | 5;

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoLocal(iso: string): Date {
  return new Date(iso);
}

function formatSlotLabel(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(parseIsoLocal(iso));
}

function slotStatusLabel(status: AvailabilitySlot["status"]): string {
  if (status === "in_process") return "In process";
  if (status === "booked") return "Booked";
  return "Available";
}

function formatMoneyFromCents(cents: number | null | undefined): string {
  if (cents == null) return "";
  try {
    return new Intl.NumberFormat("en-BD", {
      style: "currency",
      currency: "BDT",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(cents / 100);
  } catch {
    return `৳${(cents / 100).toFixed(0)}`;
  }
}

function serviceAudienceLabel(a: SalonServiceRow["audience"] | undefined): string | null {
  if (!a || a === "all") return null;
  if (a === "men") return "Men";
  if (a === "women") return "Women";
  if (a === "kids") return "Kids";
  return null;
}

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Services" },
  { n: 2, label: "Barber" },
  { n: 3, label: "Date" },
  { n: 4, label: "Time" },
  { n: 5, label: "Details" },
];

export function BookingFlow({ shopSlug }: { shopSlug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const accessToken = useSalonAccessToken();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [shopTitle, setShopTitle] = useState<string | null>(null);
  const [shopId, setShopId] = useState<number | null>(null);
  const [bookingAdvancePercent, setBookingAdvancePercent] = useState(0);
  const [queueStatus, setQueueStatus] = useState<{ activeCount: number; leadWaitMinutes: number | null } | null>(null);

  const [services, setServices] = useState<SalonServiceRow[]>([]);
  const [staff, setStaff] = useState<SalonStaffOption[]>([]);
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);

  const [selectedServiceIds, setSelectedServiceIds] = useState<number[]>([]);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [dateYmd, setDateYmd] = useState<string>(() => formatYmd(new Date()));
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [signedInCustomer, setSignedInCustomer] = useState(false);
  const [confirmAdvancePayment, setConfirmAdvancePayment] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderChannel, setReminderChannel] = useState<"sms" | "whatsapp">("sms");
  const [reminderLeadHours, setReminderLeadHours] = useState<2 | 24>(24);
  const [waitlistBusy, setWaitlistBusy] = useState(false);
  const pendingStaffParam = useRef<number | null>(null);
  const didPrefillFromQuery = useRef(false);
  const stepRef = useRef<Step>(1);

  const orderedServiceIds = useMemo(() => {
    const set = new Set(selectedServiceIds);
    return services.filter((s) => set.has(s.id)).map((s) => s.id);
  }, [services, selectedServiceIds]);

  const bookingTotals = useMemo(() => {
    const selected = services.filter((s) => orderedServiceIds.includes(s.id));
    let duration = 0;
    let priceSum = 0;
    let allPriced = true;
    for (const s of selected) {
      duration += s.duration_minutes + (s.buffer_after_minutes ?? 0);
      if (s.price_cents == null) allPriced = false;
      else priceSum += s.price_cents;
    }
    const totalCents = selected.length > 0 && allPriced ? priceSum : null;
    const advanceAmount =
      totalCents != null && bookingAdvancePercent > 0
        ? Math.round((totalCents * bookingAdvancePercent) / 100)
        : 0;
    return { duration, totalCents, advanceAmount, selected };
  }, [services, orderedServiceIds, bookingAdvancePercent]);

  function toggleService(id: number) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  const minDate = formatYmd(new Date());
  const maxD = new Date();
  maxD.setDate(maxD.getDate() + 60);
  const maxDate = formatYmd(maxD);

  const loadMeta = useCallback(async () => {
    const res = await fetchShopMeta(shopSlug);
    if (res.ok) {
      setShopTitle(res.data.name);
      setShopId(res.data.id);
      setBookingAdvancePercent(res.data.booking_advance_percent);
    }
  }, [shopSlug]);

  const loadServices = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    const res = await fetchSalonServices(shopSlug);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setServices(res.data);
  }, [shopSlug]);

  useEffect(() => {
    void loadMeta();
    void loadServices();
  }, [loadMeta, loadServices]);

  useEffect(() => {
    if (didPrefillFromQuery.current || services.length === 0) return;
    didPrefillFromQuery.current = true;
    const paramIds = searchParams
      .getAll("service_id")
      .map((v) => Number.parseInt(v, 10))
      .filter((v) => Number.isFinite(v));
    const allowed = new Set(services.map((s) => s.id));
    const nextServiceIds = paramIds.filter((id) => allowed.has(id));
    if (nextServiceIds.length > 0) {
      setSelectedServiceIds(Array.from(new Set(nextServiceIds)));
    }
    const staffRaw = searchParams.get("staff_id");
    if (staffRaw) {
      const parsed = Number.parseInt(staffRaw, 10);
      if (Number.isFinite(parsed)) pendingStaffParam.current = parsed;
    }
  }, [services, searchParams]);

  useEffect(() => {
    setConfirmAdvancePayment(false);
  }, [orderedServiceIds, bookingTotals.advanceAmount]);

  useEffect(() => {
    stepRef.current = step;
  }, [step]);

  useEffect(() => {
    if (!accessToken) {
       
      setSignedInCustomer(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      const res = await fetchAuthMe(accessToken);
      if (cancelled || !res.ok) return;
      if (res.data.role === "customer") {
        setSignedInCustomer(true);
        setCustomerName(res.data.name ?? "");
        setCustomerMobile(res.data.mobile ?? "");
      } else {
        setSignedInCustomer(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const loadStaff = useCallback(async () => {
    if (orderedServiceIds.length === 0) return;
    setBusy(true);
    setNotice(null);
    const res = await fetchSalonStaff(shopSlug, orderedServiceIds);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setStaff(res.data);
    setStaffId(null);
  }, [orderedServiceIds, shopSlug]);

  useEffect(() => {
    if (step === 2 && orderedServiceIds.length > 0) void loadStaff();
  }, [step, orderedServiceIds, loadStaff]);

  useEffect(() => {
    if (pendingStaffParam.current == null || staff.length === 0) return;
    if (staff.some((s) => s.id === pendingStaffParam.current)) {
      setStaffId(pendingStaffParam.current);
    }
    pendingStaffParam.current = null;
  }, [staff]);

  const loadQueueStatus = useCallback(async () => {
    if (shopId == null) return;
    const res = await fetchPublicQueue(shopId);
    if (!res.ok) {
      setQueueStatus(null);
      return;
    }
    const active = res.data.filter((r) => r.status === "waiting" || r.status === "in_progress");
    const leadWait = active[0]?.estimated_wait_minutes ?? null;
    setQueueStatus({ activeCount: active.length, leadWaitMinutes: leadWait });
  }, [shopId]);

  useEffect(() => {
    if (shopId == null || step < 4) return;
    void loadQueueStatus();
  }, [shopId, step, loadQueueStatus]);

  const loadSlots = useCallback(async () => {
    if (orderedServiceIds.length === 0) return;
    setBusy(true);
    setNotice(null);
    const res = await fetchAvailability(shopSlug, orderedServiceIds, dateYmd, staffId);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      setSlots([]);
      return;
    }
    setSlots(res.data);
    // Prevent stale availability refreshes from clearing chosen time on step 5.
    if (stepRef.current === 4) setStartsAt(null);
  }, [orderedServiceIds, dateYmd, staffId, shopSlug]);

  useEffect(() => {
    // Only load slots on step 4. Using step >= 4 re-ran this on step 5 and cleared the selected time (setStartsAt(null)).
    if (step === 4 && orderedServiceIds.length > 0) void loadSlots();
  }, [step, orderedServiceIds, loadSlots]);

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (orderedServiceIds.length === 0 || startsAt === null) return;
    if (bookingTotals.advanceAmount > 0 && !confirmAdvancePayment) {
      setNotice({ type: "err", text: "Please confirm you have paid the advance amount to submit this booking." });
      return;
    }
    setBusy(true);
    setNotice(null);
    const body = {
      customer_name: customerName.trim(),
      customer_mobile: customerMobile.replace(/\D/g, ""),
      salon_service_ids: orderedServiceIds,
      starts_at: startsAt,
      notes: [
        notes.trim() === "" ? null : notes.trim(),
        reminderEnabled
          ? `Reminder preference: ${reminderChannel.toUpperCase()} ${reminderLeadHours}h before appointment.`
          : "Reminder preference: opt out.",
      ]
        .filter(Boolean)
        .join("\n"),
      ...(staffId !== null ? { salon_staff_id: staffId } : {}),
      ...(bookingTotals.advanceAmount > 0 ? { confirm_advance_payment: true as const } : {}),
    };
    // Only send JWT for customer accounts — links booking to profile. Shop owners/staff book as guest (no customer_user_id).
    const res = await createPublicBooking(shopSlug, body, {
      accessToken: signedInCustomer ? accessToken ?? undefined : undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    const msg = `Booking request received and pending review. Reference #${res.data.id}.`;
    toast.success(msg);
    setConfirmAdvancePayment(false);
    if (signedInCustomer) {
      router.push("/customer/appointments");
      return;
    }
    setNotice({ type: "ok", text: msg });
    setStep(1);
    setSelectedServiceIds([]);
    setStaffId(null);
    setStartsAt(null);
    setCustomerName("");
    setCustomerMobile("");
    setNotes("");
    setDateYmd(formatYmd(new Date()));
  }

  async function submitWaitlistJoin() {
    if (!accessToken) {
      setNotice({ type: "err", text: "Please sign in as a customer first to join the waitlist." });
      return;
    }
    if (shopId == null || orderedServiceIds.length === 0) return;
    setWaitlistBusy(true);
    setNotice(null);
    const res = await joinWaitlist(accessToken, {
      shop_id: shopId,
      service_id: orderedServiceIds[0],
      staff_id: staffId,
      preferred_date: dateYmd,
    });
    setWaitlistBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "You joined the waitlist. We will notify you when a matching slot opens." });
    toast.success("Joined waitlist.");
  }

  const selectedStaffLabel = staff.find((s) => s.id === staffId)?.name ?? "Any available";
  const inProcessCount = useMemo(() => slots.filter((s) => s.status === "in_process").length, [slots]);
  const bookedCount = useMemo(() => slots.filter((s) => s.status === "booked").length, [slots]);
  const availableCount = useMemo(() => slots.filter((s) => s.status === "available").length, [slots]);

  useEffect(() => {
    if (step !== 4 || orderedServiceIds.length === 0) return;
    const timer = window.setInterval(() => {
      void loadSlots();
    }, 10000);
    return () => window.clearInterval(timer);
  }, [step, orderedServiceIds.length, loadSlots]);

  return (
    <div className="mx-auto max-w-lg">
      <div className="section-wrap mb-8 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-500/20 text-blue-200">
            <Store className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-blue-300">
              Book online
            </p>
            <h2 className="text-lg font-semibold text-white">
              {shopTitle ?? shopSlug}
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              Choose your service, select a barber, and reserve your preferred time in under 1 minute.
            </p>
            {signedInCustomer ? (
              <p className="mt-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                Signed in — after booking you will be taken to your appointments. Use your account mobile below.
              </p>
            ) : (
              <p className="mt-2 text-xs text-slate-400">
                <Link href="/app" className="font-medium text-blue-300 underline">
                  Create a customer account
                </Link>{" "}
                to track all your bookings and reminders.
              </p>
            )}
          </div>
        </div>
      </div>

      {notice && (
        <div
          className={`mb-4 rounded-xl border px-3 py-2 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
          role="status"
        >
          {notice.text}
        </div>
      )}

      <nav className="mb-6" aria-label="Booking steps">
        <ol className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
          {STEPS.map((s, idx) => (
            <li key={s.n} className="flex items-center gap-1">
              {idx > 0 ? <span className="px-0.5 text-zinc-300 dark:text-zinc-600">/</span> : null}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                  step === s.n
                    ? "bg-blue-500 text-white"
                    : step > s.n
                      ? "bg-emerald-100 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100"
                      : "bg-zinc-100 dark:bg-zinc-800"
                }`}
              >
                {step > s.n ? <Check className="h-3 w-3" aria-hidden /> : <span className="tabular-nums">{s.n}</span>}
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </nav>

      <div className="section-wrap p-6">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Choose services</h2>
            <div className="space-y-2">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-700 p-3 transition hover:bg-slate-900"
                >
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                    className="mt-1"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-white">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      {s.duration_minutes} min
                      {s.price_cents != null ? ` · ${formatMoneyFromCents(s.price_cents)}` : ""}
                      {s.category ? ` · ${s.category}` : ""}
                      {serviceAudienceLabel(s.audience) ? ` · ${serviceAudienceLabel(s.audience)}` : ""}
                    </span>
                    {(s.description?.trim() ||
                      s.requires_patch_test ||
                      s.consultation_first ||
                      (s.min_notice_hours ?? 0) > 0 ||
                      (s.deposit_cents ?? 0) > 0) && (
                      <span className="mt-1.5 block text-[11px] leading-snug text-slate-500">
                        {s.description?.trim() ? <span className="block">{s.description.trim()}</span> : null}
                        {s.requires_patch_test ? (
                          <span className="mt-0.5 block text-amber-200/90">Patch / allergy test may be required.</span>
                        ) : null}
                        {s.consultation_first ? (
                          <span className="mt-0.5 block text-sky-200/90">Salon may ask for a quick consult before the service.</span>
                        ) : null}
                        {(s.min_notice_hours ?? 0) > 0 ? (
                          <span className="mt-0.5 block">
                            Book at least {s.min_notice_hours} hour(s) ahead — first available slots follow this rule.
                          </span>
                        ) : null}
                        {(s.deposit_cents ?? 0) > 0 ? (
                          <span className="mt-0.5 block">Typical deposit: {formatMoneyFromCents(s.deposit_cents)} (confirm with salon).</span>
                        ) : null}
                      </span>
                    )}
                  </span>
                </label>
              ))}
              {services.length === 0 && !busy && (
                <p className="text-sm text-zinc-500">No services available.</p>
              )}
            </div>
            <button
              type="button"
              disabled={orderedServiceIds.length === 0 || busy}
              onClick={() => setStep(2)}
              className="w-full rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Barber preference</h2>
            <p className="text-xs text-slate-400">
              Pick someone who can do all selected services, or any available team member (
              {bookingTotals.selected.map((s) => s.name).join(", ") || "—"}).
            </p>
            <div className="space-y-2">
              {staff.length === 0 && !busy ? (
                <p className="text-sm text-amber-800 dark:text-amber-200">
                  No team member is linked to every service you picked. Go back and change your selection, or contact
                  the salon.
                </p>
              ) : null}
              {staff.map((s) => (
                <label
                  key={s.name + String(s.id)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-700 p-3 hover:bg-slate-900"
                >
                  <input
                    type="radio"
                    name="staff"
                    checked={staffId === s.id}
                    onChange={() => setStaffId(s.id)}
                  />
                  <span className="font-medium">{s.name}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-zinc-300 py-2.5 text-sm font-semibold dark:border-zinc-600"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
              <button
                type="button"
                disabled={staff.length === 0 || busy}
                onClick={() => setStep(3)}
                className="flex-1 rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-400"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Pick a date</h2>
            <label className="block text-xs font-medium text-slate-400">
              <span className="mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" aria-hidden />
                Date
              </span>
              <input
                type="date"
                min={minDate}
                max={maxDate}
                value={dateYmd}
                onChange={(e) => setDateYmd(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-zinc-300 py-2.5 text-sm font-semibold dark:border-zinc-600"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
              <button
                type="button"
                onClick={() => setStep(4)}
                className="flex-1 rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-400"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Available times</h2>
            {queueStatus ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <p>
                  Live queue: {queueStatus.activeCount} waiting
                  {queueStatus.leadWaitMinutes != null ? ` · about ${queueStatus.leadWaitMinutes} min to first chair` : ""}.
                </p>
              </div>
            ) : null}
            {busy ? (
              <p className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading slots…
              </p>
            ) : slots.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-zinc-500">
                  No available openings right now.
                  {" "}Try another date or stylist.
                </p>
                <button
                  type="button"
                  disabled={!accessToken || waitlistBusy || shopId == null || orderedServiceIds.length === 0}
                  onClick={() => void submitWaitlistJoin()}
                  className="rounded-full border border-blue-400 px-4 py-2 text-sm font-semibold text-blue-200 disabled:opacity-50"
                >
                  {waitlistBusy ? "Joining waitlist..." : "Join waitlist"}
                </button>
                {!accessToken ? (
                  <p className="text-xs text-slate-500">Sign in as a customer to join waitlist and receive alerts.</p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-3">
                {availableCount === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No open times right now.
                    {inProcessCount > 0
                      ? ` ${inProcessCount} slot(s) are in booking process and may free up soon (auto-refresh every 10 seconds).`
                      : ""}
                    {bookedCount > 0 ? ` ${bookedCount} slot(s) are already booked.` : ""}
                  </p>
                ) : null}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {slots.map((slot) => {
                  const isAvailable = slot.status === "available";
                  const isSelected = startsAt === slot.starts_at;
                  return (
                    <button
                      key={`${slot.starts_at}-${slot.status}`}
                      type="button"
                      onClick={() => (isAvailable ? setStartsAt(slot.starts_at) : undefined)}
                      disabled={!isAvailable}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                        isSelected
                          ? "border-blue-400 bg-blue-500 text-white"
                          : isAvailable
                            ? "border-slate-700 hover:bg-slate-900"
                            : "cursor-not-allowed border-zinc-300 bg-zinc-100 text-zinc-500"
                      }`}
                    >
                      <span className="block">{formatSlotLabel(slot.starts_at)}</span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-wide">
                        {slotStatusLabel(slot.status)}
                      </span>
                    </button>
                  );
                  })}
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-zinc-300 py-2.5 text-sm font-semibold dark:border-zinc-600"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
              <button
                type="button"
                disabled={startsAt === null}
                onClick={() => setStep(5)}
                className="flex-1 rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-400"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <form onSubmit={submitBooking} className="space-y-4">
            <h2 className="text-lg font-semibold text-white">Your details</h2>
            <p className="text-xs text-slate-400">
              The salon uses this to confirm your visit. Pending requests are reviewed by the team.
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-400">Name</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400">Mobile</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={customerMobile}
                onChange={(e) => setCustomerMobile(e.target.value)}
                autoComplete="tel"
                inputMode="tel"
              />
              {signedInCustomer ? (
                <p className="mt-1 text-[11px] text-zinc-500">Must match your account — change it in /app if needed.</p>
              ) : null}
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400">Notes for the barber team (optional)</label>
              <textarea
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, parking, preferred chair…"
              />
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900/70">
              <p className="text-xs font-medium text-zinc-700 dark:text-zinc-200">Reminder preferences</p>
              <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                />
                Send me a reminder before my appointment
              </label>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-zinc-500">
                  Channel
                  <select
                    value={reminderChannel}
                    onChange={(e) => setReminderChannel(e.target.value === "whatsapp" ? "whatsapp" : "sms")}
                    disabled={!reminderEnabled}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="sms">SMS</option>
                    <option value="whatsapp">WhatsApp</option>
                  </select>
                </label>
                <label className="text-xs text-zinc-500">
                  When
                  <select
                    value={String(reminderLeadHours)}
                    onChange={(e) => setReminderLeadHours(e.target.value === "2" ? 2 : 24)}
                    disabled={!reminderEnabled}
                    className="mt-1 w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="24">24 hours before</option>
                    <option value="2">2 hours before</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="rounded-xl bg-slate-900 p-3 text-xs text-slate-300">
              <p>
                <strong>{bookingTotals.selected.map((s) => s.name).join(", ")}</strong>
                {bookingTotals.totalCents != null ? ` · Total ${formatMoneyFromCents(bookingTotals.totalCents)}` : ""}
                {bookingTotals.totalCents == null && bookingTotals.selected.length > 0 ? (
                  <span className="block text-zinc-500">Total price shown when every service has a price.</span>
                ) : null}
              </p>
              {bookingTotals.advanceAmount > 0 ? (
                <p className="mt-2 font-medium text-zinc-800 dark:text-zinc-200">
                  Advance ({bookingAdvancePercent}%): {formatMoneyFromCents(bookingTotals.advanceAmount)} — pay this
                  amount before the visit (no online card charge in this version; salon may confirm manually).
                </p>
              ) : bookingAdvancePercent > 0 && bookingTotals.totalCents == null ? (
                <p className="mt-2 text-zinc-500">Advance % applies once all selected services have prices.</p>
              ) : null}
              <label className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-zinc-200 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-950">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmAdvancePayment}
                  onChange={(e) => setConfirmAdvancePayment(e.target.checked)}
                  disabled={bookingTotals.advanceAmount === 0}
                />
                <span>
                  {bookingTotals.advanceAmount > 0
                    ? `I confirm I have paid the advance of ${formatMoneyFromCents(bookingTotals.advanceAmount)} (or will pay per salon instructions).`
                    : "No advance payment required for this booking."}
                </span>
              </label>
              <p className="mt-2">
                {startsAt ? formatSlotLabel(startsAt) : ""} · {selectedStaffLabel}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(4)}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full border border-zinc-300 py-2.5 text-sm font-semibold dark:border-zinc-600"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden />
                Back
              </button>
              <button
                type="submit"
                disabled={
                  busy ||
                  startsAt === null ||
                  (bookingTotals.advanceAmount > 0 && !confirmAdvancePayment)
                }
                className="flex-1 rounded-full bg-blue-500 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:bg-blue-400"
              >
                {busy ? "…" : "Confirm booking"}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link href="/" className="font-medium text-blue-300 hover:underline">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
