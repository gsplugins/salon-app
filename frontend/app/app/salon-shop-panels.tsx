"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createServiceCatalog,
  createStaffCatalog,
  deleteServiceCatalog,
  deleteStaffCatalog,
  fetchServicesCatalog,
  fetchShopClients,
  fetchShopProfile,
  fetchShopStats,
  fetchStaffCatalog,
  formatApiError,
  patchShopProfile,
  updateServiceCatalog,
  updateStaffCatalog,
  type CatalogServiceRow,
  type CatalogStaffRow,
  type ShopClientRow,
  type ShopProfile,
  type ShopStats,
} from "@/lib/salon-api";

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
  { key: "sun", label: "Sunday" },
];

function formatMoney(cents: number | null): string {
  if (cents === null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(cents / 100);
}

function parseMoneyToCents(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t.replace(/[^0-9.-]/g, ""));
  if (Number.isNaN(n) || n < 0) return null;
  return Math.round(n * 100);
}

type DayHoursState = Record<string, { closed: boolean; open: string; close: string }>;

function hoursFromSettings(settings: Record<string, unknown> | undefined): DayHoursState {
  const bh = settings && typeof settings === "object" && "business_hours" in settings
    ? (settings.business_hours as Record<string, unknown> | undefined)
    : undefined;
  const out: DayHoursState = {};
  for (const { key } of DAYS) {
    const day = bh && typeof bh[key] === "object" && bh[key] !== null ? (bh[key] as Record<string, unknown>) : null;
    if (day && day.closed) {
      out[key] = { closed: true, open: "09:00", close: "18:00" };
    } else if (day && typeof day.open === "string" && typeof day.close === "string") {
      out[key] = { closed: false, open: day.open.slice(0, 5), close: day.close.slice(0, 5) };
    } else {
      out[key] = { closed: false, open: "09:00", close: "18:00" };
    }
  }
  return out;
}

function hoursToPayload(h: DayHoursState): Record<string, { closed?: boolean; open?: string; close?: string }> {
  const payload: Record<string, { closed?: boolean; open?: string; close?: string }> = {};
  for (const { key } of DAYS) {
    const d = h[key];
    if (!d) continue;
    if (d.closed) {
      payload[key] = { closed: true };
    } else {
      payload[key] = { open: d.open, close: d.close };
    }
  }
  return payload;
}

export function ShopOverviewPanel({
  accessToken,
  shopSlug,
}: {
  accessToken: string;
  shopSlug: string;
}) {
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const res = await fetchShopStats(accessToken);
    setBusy(false);
    if (!res.ok) {
      setErr(formatApiError(res.body));
      return;
    }
    setStats(res.data);
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial stats fetch
    void load();
  }, [load]);

  const cards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: "Bookings today", value: String(stats.bookings_today) },
      { label: "This week", value: String(stats.bookings_this_week) },
      { label: "Completed (week)", value: String(stats.completed_this_week) },
      { label: "Pending upcoming", value: String(stats.pending_upcoming) },
      { label: "Est. revenue (week)", value: formatMoney(stats.estimated_revenue_cents_this_week) },
    ];
  }, [stats]);

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </div>
      )}
      <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">At a glance</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Revenue is estimated from completed appointments and listed service prices.
        </p>
        {busy && !stats ? (
          <p className="mt-4 text-sm text-zinc-500">Loading…</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((c) => (
              <li
                key={c.label}
                className="rounded-xl border border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-950/60"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{c.label}</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{c.value}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Public booking page:{" "}
        <Link href={`/s/${shopSlug}/book`} className="font-medium text-rose-800 underline dark:text-rose-200">
          /s/{shopSlug}/book
        </Link>
      </p>
    </div>
  );
}

export function ShopServicesPanel({ accessToken }: { accessToken: string }) {
  const [rows, setRows] = useState<CatalogServiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CatalogServiceRow | null>(null);

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [duration, setDuration] = useState("30");
  const [buffer, setBuffer] = useState("0");
  const [price, setPrice] = useState("");
  const [sortOrder, setSortOrder] = useState("0");

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const res = await fetchServicesCatalog(accessToken);
    setBusy(false);
    if (!res.ok) {
      setErr(formatApiError(res.body));
      return;
    }
    setRows(res.data);
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- services catalog fetch
    void load();
  }, [load]);

  function resetForm() {
    setName("");
    setCategory("");
    setDuration("30");
    setBuffer("0");
    setPrice("");
    setSortOrder("0");
    setEditing(null);
  }

  function startEdit(s: CatalogServiceRow) {
    setEditing(s);
    setName(s.name);
    setCategory(s.category ?? "");
    setDuration(String(s.duration_minutes));
    setBuffer(String(s.buffer_after_minutes));
    setPrice(s.price_cents !== null ? (s.price_cents / 100).toFixed(2) : "");
    setSortOrder(String(s.sort_order));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const dur = Number.parseInt(duration, 10);
    const buf = Number.parseInt(buffer, 10);
    const so = Number.parseInt(sortOrder, 10);
    if (Number.isNaN(dur) || dur < 5) return;
    const priceCents = parseMoneyToCents(price);

    setBusy(true);
    setErr(null);
    if (editing) {
      const res = await updateServiceCatalog(accessToken, editing.id, {
        name: name.trim(),
        category: category.trim() === "" ? null : category.trim(),
        duration_minutes: dur,
        buffer_after_minutes: Number.isNaN(buf) ? 0 : buf,
        price_cents: priceCents,
        sort_order: Number.isNaN(so) ? 0 : so,
      });
      setBusy(false);
      if (!res.ok) {
        setErr(formatApiError(res.body));
        return;
      }
    } else {
      const res = await createServiceCatalog(accessToken, {
        name: name.trim(),
        category: category.trim() === "" ? undefined : category.trim(),
        duration_minutes: dur,
        buffer_after_minutes: Number.isNaN(buf) ? 0 : buf,
        price_cents: priceCents ?? undefined,
        sort_order: Number.isNaN(so) ? 0 : so,
      });
      setBusy(false);
      if (!res.ok) {
        setErr(formatApiError(res.body));
        return;
      }
    }
    resetForm();
    void load();
  }

  async function onToggleActive(s: CatalogServiceRow) {
    setBusy(true);
    const res = await updateServiceCatalog(accessToken, s.id, { is_active: !s.is_active });
    setBusy(false);
    if (!res.ok) {
      setErr(formatApiError(res.body));
      return;
    }
    void load();
  }

  async function onDelete(s: CatalogServiceRow) {
    if (!confirm(`Remove “${s.name}”? If it has past bookings it will be deactivated instead.`)) return;
    setBusy(true);
    const res = await deleteServiceCatalog(accessToken, s.id);
    setBusy(false);
    if (!res.ok) {
      setErr(formatApiError(res.body));
      return;
    }
    if (res.message) setErr(null);
    void load();
  }

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
          {editing ? `Edit “${editing.name}”` : "Add service"}
        </h3>
        <form onSubmit={onSubmit} className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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
            Category (optional)
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="e.g. Haircuts"
            />
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Duration (min)
            <input
              required
              type="number"
              min={5}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Buffer after (min)
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
            />
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Price (USD)
            <input
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="25.00"
            />
          </label>
          <label className="text-xs font-medium text-zinc-500">
            Sort order
            <input
              type="number"
              min={0}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
            >
              {busy ? "…" : editing ? "Save changes" : "Add service"}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => resetForm()}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600"
              >
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80">
            <tr>
              <th className="px-3 py-2">Service</th>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Duration</th>
              <th className="px-3 py-2">Buffer</th>
              <th className="px-3 py-2">Price</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-zinc-600">{s.category ?? "—"}</td>
                <td className="px-3 py-2">{s.duration_minutes} min</td>
                <td className="px-3 py-2">{s.buffer_after_minutes} min</td>
                <td className="px-3 py-2">{formatMoney(s.price_cents)}</td>
                <td className="px-3 py-2">{s.is_active ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(s)}
                    className="mr-2 text-xs font-semibold text-rose-800 hover:underline dark:text-rose-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onToggleActive(s)}
                    className="mr-2 text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDelete(s)}
                    className="text-xs font-semibold text-red-800 hover:underline dark:text-red-200"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && !busy && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-zinc-500">
                  No services yet. Add your first service above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ShopTeamPanel({ accessToken }: { accessToken: string }) {
  const [staff, setStaff] = useState<CatalogStaffRow[]>([]);
  const [services, setServices] = useState<CatalogServiceRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<CatalogStaffRow | null>(null);

  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState("0");
  const [serviceIds, setServiceIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const [st, sv] = await Promise.all([fetchStaffCatalog(accessToken), fetchServicesCatalog(accessToken)]);
    setBusy(false);
    if (!st.ok) {
      setErr(formatApiError(st.body));
      return;
    }
    if (!sv.ok) {
      setErr(formatApiError(sv.body));
      return;
    }
    setStaff(st.data);
    setServices(sv.data);
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- staff catalog fetch
    void load();
  }, [load]);

  function resetForm() {
    setName("");
    setSortOrder("0");
    setServiceIds(new Set());
    setEditing(null);
  }

  function startEdit(s: CatalogStaffRow) {
    setEditing(s);
    setName(s.name);
    setSortOrder(String(s.sort_order));
    setServiceIds(new Set(s.services.map((x) => x.id)));
  }

  function toggleService(id: number) {
    setServiceIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const so = Number.parseInt(sortOrder, 10);
    const ids = [...serviceIds];

    setBusy(true);
    setErr(null);
    if (editing) {
      const res = await updateStaffCatalog(accessToken, editing.id, {
        name: name.trim(),
        sort_order: Number.isNaN(so) ? 0 : so,
        service_ids: ids,
      });
      setBusy(false);
      if (!res.ok) {
        setErr(formatApiError(res.body));
        return;
      }
    } else {
      const res = await createStaffCatalog(accessToken, {
        name: name.trim(),
        sort_order: Number.isNaN(so) ? 0 : so,
        service_ids: ids,
      });
      setBusy(false);
      if (!res.ok) {
        setErr(formatApiError(res.body));
        return;
      }
    }
    resetForm();
    void load();
  }

  async function onToggleActive(s: CatalogStaffRow) {
    setBusy(true);
    const res = await updateStaffCatalog(accessToken, s.id, { is_active: !s.is_active });
    setBusy(false);
    if (!res.ok) {
      setErr(formatApiError(res.body));
      return;
    }
    void load();
  }

  async function onDelete(s: CatalogStaffRow) {
    if (!confirm(`Remove ${s.name}? If they have bookings they will be deactivated instead.`)) return;
    setBusy(true);
    const res = await deleteStaffCatalog(accessToken, s.id);
    setBusy(false);
    if (!res.ok) {
      setErr(formatApiError(res.body));
      return;
    }
    void load();
  }

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-white">
          {editing ? `Edit “${editing.name}”` : "Add team member"}
        </h3>
        <p className="mt-1 text-xs text-zinc-500">Choose which services each barber can perform for online booking.</p>
        <form onSubmit={onSubmit} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
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
              Sort order
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-xs font-medium text-zinc-500">Services offered</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {services.length === 0 ? (
                <span className="text-sm text-zinc-500">Add services in the Services tab first.</span>
              ) : (
                services.map((s) => (
                  <label
                    key={s.id}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-700"
                  >
                    <input
                      type="checkbox"
                      checked={serviceIds.has(s.id)}
                      onChange={() => toggleService(s.id)}
                    />
                    {s.name}
                    {!s.is_active ? <span className="text-zinc-400"> (inactive)</span> : null}
                  </label>
                ))
              )}
            </div>
          </fieldset>
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={busy}
              className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
            >
              {busy ? "…" : editing ? "Save" : "Add"}
            </button>
            {editing ? (
              <button
                type="button"
                onClick={() => resetForm()}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Services</th>
              <th className="px-3 py-2">Active</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((s) => (
              <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 font-medium">{s.name}</td>
                <td className="px-3 py-2 text-zinc-600">
                  {s.services.length ? s.services.map((x) => x.name).join(", ") : "—"}
                </td>
                <td className="px-3 py-2">{s.is_active ? "Yes" : "No"}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => startEdit(s)}
                    className="mr-2 text-xs font-semibold text-rose-800 hover:underline dark:text-rose-200"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onToggleActive(s)}
                    className="mr-2 text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onDelete(s)}
                    className="text-xs font-semibold text-red-800 hover:underline dark:text-red-200"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {staff.length === 0 && !busy && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                  No team members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ShopClientsPanel({ accessToken }: { accessToken: string }) {
  const [rows, setRows] = useState<ShopClientRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setBusy(true);
      const res = await fetchShopClients(accessToken);
      if (cancelled) return;
      setBusy(false);
      if (!res.ok) {
        setErr(formatApiError(res.body));
        return;
      }
      setRows(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  return (
    <div className="space-y-4">
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </div>
      )}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Customers grouped by mobile number from your booking history (last 200 by recent visit).
      </p>
      <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Mobile</th>
              <th className="px-3 py-2">Visits</th>
              <th className="px-3 py-2">Last visit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customer_mobile} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="px-3 py-2 font-medium">{r.customer_name}</td>
                <td className="px-3 py-2 font-mono text-xs text-zinc-500">{r.customer_mobile}</td>
                <td className="px-3 py-2">{r.visit_count}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
                    new Date(r.last_visit_at)
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !busy && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-500">
                  No clients yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ShopSettingsPanel({ accessToken }: { accessToken: string }) {
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [hours, setHours] = useState<DayHoursState>(() => hoursFromSettings(undefined));
  const [leadHours, setLeadHours] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setErr(null);
    const res = await fetchShopProfile(accessToken);
    setBusy(false);
    setReady(true);
    if (!res.ok) {
      setErr(formatApiError(res.body));
      return;
    }
    const p = res.data;
    setProfile(p);
    setName(p.name);
    setDescription(p.description ?? "");
    setPhone(p.phone ?? "");
    setEmail(p.email ?? "");
    setAddress(p.address ?? "");
    setHours(hoursFromSettings(p.settings as Record<string, unknown>));
    const st = p.settings as Record<string, unknown>;
    const lead = st?.min_lead_time_hours;
    setLeadHours(typeof lead === "number" ? String(lead) : typeof lead === "string" ? lead : "0");
    const cur = st?.currency;
    setCurrency(typeof cur === "string" && cur ? cur : "USD");
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- shop profile fetch
    void load();
  }, [load]);

  function setDay(key: string, patch: Partial<{ closed: boolean; open: string; close: string }>) {
    setHours((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const lh = Number.parseInt(leadHours, 10);
    setBusy(true);
    setErr(null);
    const res = await patchShopProfile(accessToken, {
      name: name.trim(),
      description: description.trim() === "" ? null : description.trim(),
      phone: phone.trim() === "" ? null : phone.trim(),
      email: email.trim() === "" ? null : email.trim(),
      address: address.trim() === "" ? null : address.trim(),
      settings: {
        business_hours: hoursToPayload(hours),
        min_lead_time_hours: Number.isNaN(lh) ? 0 : Math.max(0, lh),
        currency: currency.trim() || "USD",
      },
    });
    setBusy(false);
    if (!res.ok) {
      setErr(formatApiError(res.body));
      return;
    }
    setProfile(res.data);
  }

  if (!ready) {
    return <p className="text-sm text-zinc-500">Loading shop settings…</p>;
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        {err && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
            {err}
          </div>
        )}
        <button
          type="button"
          onClick={() => {
            setReady(false);
            void load();
          }}
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
          {err}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-8">
        <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Contact & basics</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
              Shop name
              <input
                required
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
              Description
              <textarea
                rows={3}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-zinc-500">
              Phone
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-zinc-500">
              Email
              <input
                type="email"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-zinc-500 sm:col-span-2">
              Address
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Business hours</h3>
          <p className="mt-1 text-xs text-zinc-500">Used for online availability. Closed days block booking.</p>
          <ul className="mt-4 space-y-3">
            {DAYS.map(({ key, label }) => {
              const d = hours[key];
              if (!d) return null;
              return (
                <li
                  key={key}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700"
                >
                  <span className="w-28 text-sm font-medium">{label}</span>
                  <label className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={d.closed}
                      onChange={(e) => setDay(key, { closed: e.target.checked })}
                    />
                    Closed
                  </label>
                  {!d.closed ? (
                    <>
                      <label className="flex items-center gap-2 text-xs text-zinc-500">
                        Open
                        <input
                          type="time"
                          className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                          value={d.open}
                          onChange={(e) => setDay(key, { open: e.target.value })}
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs text-zinc-500">
                        Close
                        <input
                          type="time"
                          className="rounded border border-zinc-200 px-2 py-1 dark:border-zinc-700 dark:bg-zinc-950"
                          value={d.close}
                          onChange={(e) => setDay(key, { close: e.target.value })}
                        />
                      </label>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h3 className="text-base font-semibold text-zinc-900 dark:text-white">Booking rules</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-zinc-500">
              Minimum lead time (hours)
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={leadHours}
                onChange={(e) => setLeadHours(e.target.value)}
              />
            </label>
            <label className="text-xs font-medium text-zinc-500">
              Currency code
              <input
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                placeholder="USD"
              />
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
        >
          {busy ? "Saving…" : "Save shop settings"}
        </button>
      </form>
    </div>
  );
}
