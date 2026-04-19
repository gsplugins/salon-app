"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createBlockedSlot,
  createWalkInBooking,
  deleteBlockedSlot,
  fetchAdminBookings,
  fetchBlockedSlots,
  fetchSalonServices,
  fetchSalonStaff,
  formatApiError,
  patchBooking,
  type BlockedSlotRow,
  type BookingRow,
  type SalonServiceRow,
  type SalonStaffOption,
} from "@/lib/salon-api";
import {
  ShopClientsPanel,
  ShopOverviewPanel,
  ShopServicesPanel,
  ShopSettingsPanel,
  ShopTeamPanel,
} from "@/app/app/salon-shop-panels";

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No-show" },
] as const;

function formatYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function mondayOfWeek(ref: Date): Date {
  const d = new Date(ref);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  d.setHours(12, 0, 0, 0);
  return d;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function formatShort(iso: string): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

type ViewMode = "calendar" | "list";

type AdminSection = "overview" | "bookings" | "services" | "team" | "clients" | "shop";

const SECTIONS: { id: AdminSection; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "bookings", label: "Bookings" },
  { id: "services", label: "Services" },
  { id: "team", label: "Team" },
  { id: "clients", label: "Clients" },
  { id: "shop", label: "Shop settings" },
];

export function SalonBookingAdmin({
  accessToken,
  shopSlug,
}: {
  accessToken: string;
  shopSlug: string;
}) {
  const [section, setSection] = useState<AdminSection>("overview");
  const [view, setView] = useState<ViewMode>("calendar");
  const bookingsActive = section === "bookings";
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [blocks, setBlocks] = useState<BlockedSlotRow[]>([]);
  const [services, setServices] = useState<SalonServiceRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const weekStart = useMemo(() => mondayOfWeek(weekAnchor), [weekAnchor]);
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);
  const fromStr = formatYmd(weekStart);
  const toStr = formatYmd(weekEnd);

  const loadAll = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    const [b, bl, sv] = await Promise.all([
      fetchAdminBookings(fromStr, toStr, accessToken),
      fetchBlockedSlots(fromStr, toStr, accessToken),
      fetchSalonServices(shopSlug),
    ]);
    setBusy(false);
    if (!b.ok) {
      setNotice({ type: "err", text: formatApiError(b.body) });
      return;
    }
    if (!bl.ok) {
      setNotice({ type: "err", text: formatApiError(bl.body) });
      return;
    }
    if (!sv.ok) {
      setNotice({ type: "err", text: formatApiError(sv.body) });
      return;
    }
    setBookings(b.data);
    setBlocks(bl.data);
    setServices(sv.data);
  }, [accessToken, fromStr, toStr, shopSlug]);

  useEffect(() => {
    if (!bookingsActive) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch bookings when tab/week changes
    void loadAll();
  }, [loadAll, bookingsActive]);

  const dayLabels = useMemo(() => {
    const out: { date: Date; key: string; label: string }[] = [];
    for (let i = 0; i < 7; i += 1) {
      const d = addDays(weekStart, i);
      out.push({
        date: d,
        key: formatYmd(d),
        label: new Intl.DateTimeFormat(undefined, { weekday: "short", month: "short", day: "numeric" }).format(d),
      });
    }
    return out;
  }, [weekStart]);

  async function onStatusChange(id: number, status: string) {
    setBusy(true);
    const res = await patchBooking(accessToken, id, { status });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Booking updated." });
    void loadAll();
  }

  async function onDeleteBlock(id: number) {
    if (!confirm("Remove this blocked time?")) return;
    setBusy(true);
    const res = await deleteBlockedSlot(accessToken, id);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    void loadAll();
  }

  return (
    <div className="mt-10 space-y-8 border-t border-rose-100/80 pt-10 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Shop management</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Run your shop from one place: performance snapshot, bookings, service menu, team, clients, and
          business details.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              section === s.id
                ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                : "border border-zinc-200 text-zinc-600 dark:border-zinc-700 dark:text-zinc-300"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "overview" && <ShopOverviewPanel accessToken={accessToken} shopSlug={shopSlug} />}

      {section === "services" && <ShopServicesPanel accessToken={accessToken} />}

      {section === "team" && <ShopTeamPanel accessToken={accessToken} />}

      {section === "clients" && <ShopClientsPanel accessToken={accessToken} />}

      {section === "shop" && <ShopSettingsPanel accessToken={accessToken} />}

      {bookingsActive && (
        <>
      <div>
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Bookings</h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Calendar and list share the same data. Toggle views, update statuses (SMS goes to the customer on
          change), add walk-ins, and block time for leave or shop closure.
        </p>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
        >
          {notice.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border border-zinc-200 p-1 dark:border-zinc-700">
          <button
            type="button"
            onClick={() => setView("calendar")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              view === "calendar"
                ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              view === "list"
                ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            List
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => setWeekAnchor(addDays(weekAnchor, -7))}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            ‹ Week
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setWeekAnchor(new Date())}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            This week
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setWeekAnchor(addDays(weekAnchor, 7))}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600"
          >
            Week ›
          </button>
        </div>
      </div>

      {view === "calendar" ? (
        <CalendarWeek
          dayLabels={dayLabels}
          bookings={bookings}
          onStatusChange={onStatusChange}
          busy={busy}
        />
      ) : (
        <ListView bookings={bookings} onStatusChange={onStatusChange} busy={busy} />
      )}

      <WalkInForm
        accessToken={accessToken}
        shopSlug={shopSlug}
        services={services}
        busy={busy}
        setBusy={setBusy}
        onDone={() => void loadAll()}
        onNotice={setNotice}
      />

      <BlockTimeForm
        accessToken={accessToken}
        shopSlug={shopSlug}
        busy={busy}
        setBusy={setBusy}
        onDone={() => void loadAll()}
        onNotice={setNotice}
      />

      <BlockedList blocks={blocks} busy={busy} onDelete={onDeleteBlock} />
        </>
      )}
    </div>
  );
}

function CalendarWeek(props: {
  dayLabels: { date: Date; key: string; label: string }[];
  bookings: BookingRow[];
  onStatusChange: (id: number, status: string) => void;
  busy: boolean;
}) {
  const { dayLabels, bookings, onStatusChange, busy } = props;

  return (
    <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      <div className="grid min-w-[720px] grid-cols-7 gap-px bg-zinc-200 dark:bg-zinc-800">
        {dayLabels.map((d) => (
          <div key={d.key} className="bg-zinc-50 px-2 py-2 text-center text-xs font-semibold dark:bg-zinc-950">
            {d.label}
          </div>
        ))}
        {dayLabels.map((d) => {
          const items = bookings.filter(
            (b) => formatYmd(startOfDay(new Date(b.starts_at))) === d.key
          );
          return (
            <div key={`c-${d.key}`} className="min-h-[220px] bg-white p-2 align-top dark:bg-zinc-900/40">
              <ul className="space-y-2">
                {items.map((b) => (
                  <li
                    key={b.id}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-2 text-xs dark:border-zinc-700 dark:bg-zinc-950/60"
                  >
                    <p className="font-medium text-zinc-900 dark:text-white">{b.customer_name}</p>
                    <p className="text-zinc-500">
                      {new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(
                        new Date(b.starts_at)
                      )}{" "}
                      · {b.service.name}
                      {b.service.category ? (
                        <span className="text-zinc-400"> ({b.service.category})</span>
                      ) : null}
                    </p>
                    <p className="text-zinc-500">{b.staff.name}</p>
                    <select
                      disabled={busy}
                      value={b.status}
                      onChange={(e) => onStatusChange(b.id, e.target.value)}
                      className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-1 py-1 text-[11px] dark:border-zinc-700 dark:bg-zinc-950"
                    >
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView(props: {
  bookings: BookingRow[];
  onStatusChange: (id: number, status: string) => void;
  busy: boolean;
}) {
  const sorted = [...props.bookings].sort(
    (a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime()
  );
  return (
    <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80">
          <tr>
            <th className="px-3 py-2">When</th>
            <th className="px-3 py-2">Customer</th>
            <th className="px-3 py-2">Service</th>
            <th className="px-3 py-2">Staff</th>
            <th className="px-3 py-2">Source</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((b) => (
            <tr key={b.id} className="border-b border-zinc-100 dark:border-zinc-800">
              <td className="px-3 py-2 whitespace-nowrap">{formatShort(b.starts_at)}</td>
              <td className="px-3 py-2">
                <div className="font-medium">{b.customer_name}</div>
                <div className="font-mono text-xs text-zinc-500">{b.customer_mobile}</div>
              </td>
              <td className="px-3 py-2">
                <div>{b.service.name}</div>
                {b.service.category ? (
                  <div className="text-xs text-zinc-500">{b.service.category}</div>
                ) : null}
              </td>
              <td className="px-3 py-2">{b.staff.name}</td>
              <td className="px-3 py-2 capitalize">{b.source.replace("_", " ")}</td>
              <td className="px-3 py-2">
                <select
                  disabled={props.busy}
                  value={b.status}
                  onChange={(e) => props.onStatusChange(b.id, e.target.value)}
                  className="w-full max-w-[140px] rounded-md border border-zinc-200 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </td>
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={6} className="px-3 py-6 text-center text-zinc-500">
                No bookings this week.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function WalkInForm(props: {
  accessToken: string;
  shopSlug: string;
  services: SalonServiceRow[];
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: () => void;
  onNotice: (n: { type: "ok" | "err"; text: string } | null) => void;
}) {
  const [serviceId, setServiceId] = useState<number | "">("");
  const [staffOptions, setStaffOptions] = useState<SalonStaffOption[]>([]);
  const [staffId, setStaffId] = useState<number | null>(null);
  const [startsLocal, setStartsLocal] = useState("");
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (serviceId === "") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset staff when service cleared
      setStaffOptions([]);
      setStaffId(null);
      return;
    }
    void (async () => {
      const res = await fetchSalonStaff(props.shopSlug, serviceId);
      if (res.ok) {
        setStaffOptions(res.data);
        setStaffId(null);
      }
    })();
  }, [serviceId, props.shopSlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (serviceId === "" || !startsLocal) return;
    props.setBusy(true);
    props.onNotice(null);
    const starts = new Date(startsLocal);
    const body = {
      customer_name: name.trim(),
      customer_mobile: mobile.trim(),
      salon_service_id: serviceId,
      starts_at: starts.toISOString(),
      notes: notes.trim() === "" ? undefined : notes.trim(),
      ...(staffId !== null ? { salon_staff_id: staffId } : {}),
    };
    const res = await createWalkInBooking(props.accessToken, body);
    props.setBusy(false);
    if (!res.ok) {
      props.onNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    props.onNotice({ type: "ok", text: "Walk-in saved." });
    setName("");
    setMobile("");
    setNotes("");
    props.onDone();
  }

  return (
    <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Add walk-in</h3>
      <p className="mt-1 text-xs text-zinc-500">Creates a booking with source &quot;walk in&quot; (default status: confirmed).</p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Service
          <select
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={serviceId === "" ? "" : String(serviceId)}
            onChange={(e) => setServiceId(e.target.value === "" ? "" : Number(e.target.value))}
          >
            <option value="">Select…</option>
            {props.services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Stylist (optional)
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={staffId === null ? "" : String(staffId)}
            onChange={(e) => {
              const v = e.target.value;
              setStaffId(v === "" ? null : Number(v));
            }}
          >
            <option value="">Any available</option>
            {staffOptions
              .filter((o) => o.id !== null)
              .map((o) => (
                <option key={o.id} value={o.id ?? ""}>
                  {o.name}
                </option>
              ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Start time
          <input
            required
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Name
          <input
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          Mobile
          <input
            required
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Notes (optional)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={props.busy}
          className="sm:col-span-2 rounded-full bg-zinc-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
        >
          {props.busy ? "…" : "Save walk-in"}
        </button>
      </form>
    </div>
  );
}

function BlockTimeForm(props: {
  accessToken: string;
  shopSlug: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  onDone: () => void;
  onNotice: (n: { type: "ok" | "err"; text: string } | null) => void;
}) {
  const [staffRows, setStaffRows] = useState<SalonStaffOption[]>([]);
  const [scope, setScope] = useState<"shop" | "staff">("shop");
  const [staffId, setStaffId] = useState<number | null>(null);
  const [startsLocal, setStartsLocal] = useState("");
  const [endsLocal, setEndsLocal] = useState("");
  const [kind, setKind] = useState<"leave" | "holiday">("leave");
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetchSalonServices(props.shopSlug);
      if (!res.ok || res.data.length === 0) return;
      const st = await fetchSalonStaff(props.shopSlug, res.data[0].id);
      if (!cancelled && st.ok) {
        setStaffRows(st.data.filter((o) => o.id !== null));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.shopSlug]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!startsLocal || !endsLocal) return;
    if (scope === "staff" && staffId === null) {
      props.onNotice({ type: "err", text: "Select a stylist for a staff block." });
      return;
    }
    props.setBusy(true);
    props.onNotice(null);
    const body = {
      starts_at: new Date(startsLocal).toISOString(),
      ends_at: new Date(endsLocal).toISOString(),
      kind,
      reason: reason.trim() === "" ? undefined : reason.trim(),
      ...(scope === "shop" ? { salon_staff_id: null } : { salon_staff_id: staffId as number }),
    };
    const res = await createBlockedSlot(props.accessToken, body);
    props.setBusy(false);
    if (!res.ok) {
      props.onNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    props.onNotice({ type: "ok", text: "Time blocked." });
    setStartsLocal("");
    setEndsLocal("");
    setReason("");
    props.onDone();
  }

  return (
    <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Block time</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Staff leave blocks one stylist. Shop holiday blocks everyone for that window.
      </p>
      <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Scope
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={scope === "shop" ? "shop" : String(staffId ?? "")}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "shop") {
                setScope("shop");
                setStaffId(null);
                return;
              }
              setScope("staff");
              setStaffId(Number(v));
            }}
          >
            <option value="shop">Whole shop</option>
            {staffRows.map((o) => (
              <option key={o.id} value={o.id ?? ""}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500">
          From
          <input
            required
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={startsLocal}
            onChange={(e) => setStartsLocal(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500">
          To
          <input
            required
            type="datetime-local"
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={endsLocal}
            onChange={(e) => setEndsLocal(e.target.value)}
          />
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Kind
          <select
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={kind}
            onChange={(e) => setKind(e.target.value as "leave" | "holiday")}
          >
            <option value="leave">Staff leave</option>
            <option value="holiday">Shop holiday</option>
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
          Reason (optional)
          <input
            className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        <button
          type="submit"
          disabled={props.busy}
          className="sm:col-span-2 rounded-full border border-zinc-300 py-2.5 text-sm font-semibold dark:border-zinc-600"
        >
          {props.busy ? "…" : "Add block"}
        </button>
      </form>
    </div>
  );
}

function BlockedList(props: {
  blocks: BlockedSlotRow[];
  busy: boolean;
  onDelete: (id: number) => void;
}) {
  if (props.blocks.length === 0) return null;
  return (
    <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
      <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Blocked times this week</h3>
      <ul className="mt-3 space-y-2 text-sm">
        {props.blocks.map((b) => (
          <li
            key={b.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
          >
            <span>
              <span className="font-medium capitalize">{b.scope === "shop" ? "Shop" : b.staff?.name}</span>
              <span className="text-zinc-500">
                {" "}
                · {formatShort(b.starts_at)} – {formatShort(b.ends_at)} · {b.kind}
              </span>
            </span>
            <button
              type="button"
              disabled={props.busy}
              onClick={() => props.onDelete(b.id)}
              className="text-xs font-semibold text-rose-800 hover:underline dark:text-rose-200"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
