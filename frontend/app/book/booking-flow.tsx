"use client";

import Link from "next/link";
import { Calendar, Check, ChevronLeft, Loader2, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { fetchAuthMe } from "@/lib/auth-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import {
  createPublicBooking,
  fetchAvailability,
  fetchSalonServices,
  fetchSalonStaff,
  fetchShopMeta,
  formatApiError,
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

const STEPS: { n: Step; label: string }[] = [
  { n: 1, label: "Service" },
  { n: 2, label: "Stylist" },
  { n: 3, label: "Date" },
  { n: 4, label: "Time" },
  { n: 5, label: "Confirm" },
];

export function BookingFlow({ shopSlug }: { shopSlug: string }) {
  const accessToken = useSalonAccessToken();
  const [step, setStep] = useState<Step>(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [shopTitle, setShopTitle] = useState<string | null>(null);

  const [services, setServices] = useState<SalonServiceRow[]>([]);
  const [staff, setStaff] = useState<SalonStaffOption[]>([]);
  const [slots, setSlots] = useState<string[]>([]);

  const [serviceId, setServiceId] = useState<number | null>(null);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [dateYmd, setDateYmd] = useState<string>(() => formatYmd(new Date()));
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [notes, setNotes] = useState("");
  const [signedInCustomer, setSignedInCustomer] = useState(false);

  const selectedService = useMemo(
    () => services.find((s) => s.id === serviceId) ?? null,
    [services, serviceId]
  );

  const minDate = formatYmd(new Date());
  const maxD = new Date();
  maxD.setDate(maxD.getDate() + 60);
  const maxDate = formatYmd(maxD);

  const loadMeta = useCallback(async () => {
    const res = await fetchShopMeta(shopSlug);
    if (res.ok) setShopTitle(res.data.name);
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
    if (serviceId === null) return;
    setBusy(true);
    setNotice(null);
    const res = await fetchSalonStaff(shopSlug, serviceId);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setStaff(res.data);
    setStaffId(null);
  }, [serviceId, shopSlug]);

  useEffect(() => {
     
    if (step === 2 && serviceId !== null) void loadStaff();
  }, [step, serviceId, loadStaff]);

  const loadSlots = useCallback(async () => {
    if (serviceId === null) return;
    setBusy(true);
    setNotice(null);
    const res = await fetchAvailability(shopSlug, serviceId, dateYmd, staffId);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      setSlots([]);
      return;
    }
    setSlots(res.data);
    setStartsAt(null);
  }, [serviceId, dateYmd, staffId, shopSlug]);

  useEffect(() => {
    // Only load slots on step 4. Using step >= 4 re-ran this on step 5 and cleared the selected time (setStartsAt(null)).
     
    if (step === 4 && serviceId !== null) void loadSlots();
  }, [step, serviceId, loadSlots]);

  async function submitBooking(e: React.FormEvent) {
    e.preventDefault();
    if (serviceId === null || startsAt === null) return;
    setBusy(true);
    setNotice(null);
    const body = {
      customer_name: customerName.trim(),
      customer_mobile: customerMobile.replace(/\D/g, ""),
      salon_service_id: serviceId,
      starts_at: startsAt,
      notes: notes.trim() === "" ? undefined : notes.trim(),
      ...(staffId !== null ? { salon_staff_id: staffId } : {}),
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
    const msg = `Booking request received. Status: pending — the salon will confirm. Reference #${res.data.id}.`;
    toast.success(msg);
    setNotice({
      type: "ok",
      text: msg,
    });
    setStep(1);
    setServiceId(null);
    setStaffId(null);
    setStartsAt(null);
    if (!signedInCustomer) {
      setCustomerName("");
      setCustomerMobile("");
    }
    setNotes("");
    setDateYmd(formatYmd(new Date()));
  }

  const selectedStaffLabel = staff.find((s) => s.id === staffId)?.name ?? "Any available";

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-8 rounded-2xl border border-rose-100/80 bg-gradient-to-br from-white to-rose-50/50 p-5 shadow-sm dark:border-zinc-800 dark:from-zinc-900/80 dark:to-zinc-950/80">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100">
            <Store className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-800/80 dark:text-rose-200/80">
              Book online
            </p>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {shopTitle ?? shopSlug}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Pick a service, time, and contact — you will get updates by SMS when the shop confirms or changes your
              visit.
            </p>
            {signedInCustomer ? (
              <p className="mt-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
                Signed in — your visit will appear under My dashboard. Use your account mobile below.
              </p>
            ) : (
              <p className="mt-2 text-xs text-zinc-500">
                <Link href="/app" className="font-medium text-rose-800 underline dark:text-rose-200">
                  Create a customer account
                </Link>{" "}
                to track bookings in one place.
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
        <ol className="flex flex-wrap items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
          {STEPS.map((s, idx) => (
            <li key={s.n} className="flex items-center gap-1">
              {idx > 0 ? <span className="px-0.5 text-zinc-300 dark:text-zinc-600">/</span> : null}
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium ${
                  step === s.n
                    ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
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

      <div className="rounded-2xl border border-rose-100/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Choose a service</h2>
            <div className="space-y-2">
              {services.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-200 p-3 transition hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
                >
                  <input
                    type="radio"
                    name="svc"
                    checked={serviceId === s.id}
                    onChange={() => setServiceId(s.id)}
                    className="mt-1"
                  />
                  <span className="flex-1">
                    <span className="font-medium text-zinc-900 dark:text-white">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {s.duration_minutes} min
                      {s.price_cents != null ? ` · ${formatMoneyFromCents(s.price_cents)}` : ""}
                      {s.category ? ` · ${s.category}` : ""}
                    </span>
                  </span>
                </label>
              ))}
              {services.length === 0 && !busy && (
                <p className="text-sm text-zinc-500">No services available.</p>
              )}
            </div>
            <button
              type="button"
              disabled={serviceId === null || busy}
              onClick={() => setStep(2)}
              className="w-full rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
            >
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Stylist preference</h2>
            <p className="text-xs text-zinc-500">
              Pick someone specific or any available team member for {selectedService?.name}.
            </p>
            <div className="space-y-2">
              {staff.map((s) => (
                <label
                  key={s.name + String(s.id)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
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
                className="flex-1 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Pick a date</h2>
            <label className="block text-xs font-medium text-zinc-500">
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
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
                className="flex-1 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Available times</h2>
            {busy ? (
              <p className="flex items-center gap-2 text-sm text-zinc-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Loading slots…
              </p>
            ) : slots.length === 0 ? (
              <p className="text-sm text-zinc-500">No openings that day. Try another date or stylist.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {slots.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setStartsAt(iso)}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                      startsAt === iso
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-rose-100 dark:bg-rose-100 dark:text-zinc-900"
                        : "border-zinc-200 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800/50"
                    }`}
                  >
                    {formatSlotLabel(iso)}
                  </button>
                ))}
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
                className="flex-1 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 5 && (
          <form onSubmit={submitBooking} className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Your details</h2>
            <p className="text-xs text-zinc-500">
              The salon uses this to confirm your visit. Pending requests are reviewed by the team.
            </p>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Name</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                autoComplete="name"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500">Mobile</label>
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
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
              <label className="block text-xs font-medium text-zinc-500">Notes for the salon (optional)</label>
              <textarea
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Allergies, parking, preferred chair…"
              />
            </div>
            <div className="rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
              <p>
                <strong>{selectedService?.name}</strong>
                {selectedService?.price_cents != null
                  ? ` · ${formatMoneyFromCents(selectedService.price_cents)}`
                  : ""}
              </p>
              <p className="mt-1">
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
                disabled={busy || startsAt === null}
                className="flex-1 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
              >
                {busy ? "…" : "Request booking"}
              </button>
            </div>
          </form>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-zinc-500">
        <Link href="/" className="font-medium text-rose-800 hover:underline dark:text-rose-200">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
