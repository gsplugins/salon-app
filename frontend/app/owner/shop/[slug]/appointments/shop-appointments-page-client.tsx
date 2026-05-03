"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchAdminBookings,
  fetchShopProfile,
  fetchStaffCatalog,
  fetchOwnerCustomerRiskProfile,
  formatApiError,
  patchBooking,
  type BookingRow,
  type CatalogStaffRow,
  type OwnerCustomerRiskProfile,
} from "@/lib/salon-api";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const STATUS_KEYS = ["confirmed", "completed", "cancelled", "pending", "no_show"] as const;
const DAY_WINDOW = 6; // today + previous 5 days

function statusBadgeClass(status: string): string {
  if (status === "pending") return "bg-amber-100 text-amber-800";
  if (status === "confirmed") return "bg-blue-100 text-blue-800";
  if (status === "completed") return "bg-emerald-100 text-emerald-800";
  if (status === "cancelled") return "bg-rose-100 text-rose-800";
  return "bg-zinc-200 text-zinc-700";
}

function statusLabel(status: string): string {
  if (status === "confirmed") return "Booked";
  if (status === "no_show") return "No-show";
  if (!status) return "Unknown";
  return status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
}

function FormBody({ accessToken }: { accessToken: string }) {
  const [from] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - (DAY_WINDOW - 1));
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [status, setStatus] = useState("");
  const [staffId, setStaffId] = useState<string>("");
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [staff, setStaff] = useState<CatalogStaffRow[]>([]);
  const [canViewAppointments, setCanViewAppointments] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BookingRow | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [riskProfile, setRiskProfile] = useState<OwnerCustomerRiskProfile | null>(null);
  const [riskBusy, setRiskBusy] = useState(false);

  const fetchBookings = useCallback(async () => {
    const selectedStaffId = staffId ? Number.parseInt(staffId, 10) : undefined;
    return fetchAdminBookings(accessToken, {
      from: `${from}T00:00:00`,
      to: `${to}T23:59:59`,
      status: status || undefined,
      ...(selectedStaffId && !Number.isNaN(selectedStaffId) ? { staff_id: selectedStaffId } : {}),
    });
  }, [accessToken, from, to, status, staffId]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchBookings();
    setLoading(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setRows(res.data);
  }, [fetchBookings]);

  /** Permissions + staff + bookings in one flow (avoids waiting on React state between permission and list fetches). */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [permRes, staffRes] = await Promise.all([fetchShopProfile(accessToken), fetchStaffCatalog(accessToken)]);
      if (cancelled) return;
      if (staffRes.ok) setStaff(staffRes.data);
      if (!permRes.ok) {
        setCanViewAppointments(false);
        setLoading(false);
        setRows([]);
        return;
      }
      const canView = permRes.data.permissions?.can_edit_booking_rules === true;
      setCanViewAppointments(canView);
      if (!canView) {
        setLoading(false);
        setRows([]);
        return;
      }
      const res = await fetchBookings();
      if (cancelled) return;
      setLoading(false);
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        return;
      }
      setRows(res.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, fetchBookings]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [rows]);
  const slotsByDay = useMemo(() => {
    const map = new Map<string, BookingRow[]>();
    for (let i = 0; i < DAY_WINDOW; i += 1) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      map.set(isoDate(d), []);
    }
    for (const b of sorted) {
      const day = b.starts_at.slice(0, 10);
      const bucket = map.get(day);
      if (bucket) bucket.push(b);
    }
    return [...map.entries()].map(([day, bookings]) => ({
      day,
      bookings: [...bookings].sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    }));
  }, [sorted]);
  const scheduleByStaff = useMemo(() => {
    const grouped = new Map<
      number,
      { staffName: string; totals: Record<string, number>; nextAt: string | null; total: number }
    >();
    for (const b of rows) {
      const current =
        grouped.get(b.staff.id) ??
        {
          staffName: b.staff.name,
          totals: { confirmed: 0, completed: 0, cancelled: 0, pending: 0, no_show: 0 },
          nextAt: null,
          total: 0
        };
      current.total += 1;
      if (STATUS_KEYS.includes(b.status as (typeof STATUS_KEYS)[number])) current.totals[b.status] += 1;
      if ((b.status === "confirmed" || b.status === "pending") && (!current.nextAt || b.starts_at < current.nextAt)) {
        current.nextAt = b.starts_at;
      }
      grouped.set(b.staff.id, current);
    }
    return [...grouped.entries()]
      .map(([staffIdKey, data]) => ({ staffId: staffIdKey, ...data }))
      .sort((a, b) => a.staffName.localeCompare(b.staffName));
  }, [rows]);

  useEffect(() => {
    async function run() {
      if (!active) {
        setRiskProfile(null);
        return;
      }
      setRiskBusy(true);
      const res = await fetchOwnerCustomerRiskProfile(accessToken, active.customer_mobile);
      setRiskBusy(false);
      if (!res.ok) {
        setRiskProfile(null);
        return;
      }
      setRiskProfile(res.data);
    }
    void run();
  }, [active, accessToken]);

  async function saveStatus(next: string) {
    if (!active) return;
    setBusy(true);
    const res = await patchBooking(accessToken, active.id, { status: next });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Appointment updated");
    setActive(null);
    void load();
  }

  async function saveNotes() {
    if (!active) return;
    setBusy(true);
    const res = await patchBooking(accessToken, active.id, { notes: notes.trim() === "" ? null : notes.trim() });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Notes saved");
    setActive(null);
    void load();
  }

  if (canViewAppointments === null) {
    return <Skeleton className="h-64 w-full rounded-2xl" />;
  }

  if (canViewAppointments === false) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        Only shop admin/manager can view appointment slots.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div>
          <Label>Range</Label>
          <p className="mt-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700">
            {new Date(from).toLocaleDateString()} - {new Date(to).toLocaleDateString()} (last 5 days + today)
          </p>
        </div>
        <div>
          <Label htmlFor="st">Status</Label>
          <select
            id="st"
            className="mt-1 w-40 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
        <div>
          <Label htmlFor="staff">Staff</Label>
          <select
            id="staff"
            className="mt-1 w-44 rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            value={staffId}
            onChange={(e) => setStaffId(e.target.value)}
          >
            <option value="">All staff</option>
            {staff.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {canViewAppointments === true ? (
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold text-zinc-800 dark:text-white">Daily booking slots (today + last 5 days)</h2>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {slotsByDay.map((dayRow) => (
              <div key={dayRow.day} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="text-sm font-semibold text-zinc-800 dark:text-white">
                  {new Date(dayRow.day).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                </p>
                {dayRow.bookings.length === 0 ? (
                  <p className="mt-2 text-xs text-zinc-800">No slots booked.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {dayRow.bookings.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => {
                          setActive(b);
                          setNotes(b.notes ?? "");
                        }}
                        className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-left text-xs hover:border-zinc-400 dark:border-zinc-700 dark:bg-zinc-950"
                      >
                        <span className="block font-medium">
                          {new Date(b.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        </span>
                        <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 ${statusBadgeClass(b.status)}`}>
                          {statusLabel(b.status)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-white">Staff schedule by status</h2>
        {scheduleByStaff.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-800">No booking data in selected range.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {scheduleByStaff.map((row) => (
              <div key={row.staffId} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                <p className="font-medium text-zinc-800 dark:text-white">{row.staffName}</p>
                <p className="mt-1 text-xs text-zinc-800">
                  Total {row.total}
                  {row.nextAt ? ` · Next ${new Date(row.nextAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}` : ""}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">Pending {row.totals.pending}</span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-800">Confirmed {row.totals.confirmed}</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">Completed {row.totals.completed}</span>
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-800">Cancelled {row.totals.cancelled}</span>
                  <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-zinc-700">No-show {row.totals.no_show}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 [&>div]:rounded-2xl [&>div]:border-0">
          <Table>
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Customer</TH>
                <TH>Service</TH>
                <TH>Staff</TH>
                <TH>Rating</TH>
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {sorted.length === 0 ? (
                <TR>
                  <TD colSpan={7} className="text-center text-sm text-zinc-800">
                    No appointments in this range.
                  </TD>
                </TR>
              ) : (
                sorted.map((b) => (
                  <TR key={b.id}>
                    <TD className="whitespace-nowrap text-sm">
                      {new Date(b.starts_at).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" })}
                    </TD>
                    <TD className="text-sm">
                      <div className="font-medium">{b.customer_name}</div>
                      <div className="text-xs text-zinc-800">{b.customer_mobile}</div>
                    </TD>
                    <TD className="text-sm">{b.service.name}</TD>
                    <TD className="text-sm">{b.staff.name}</TD>
                    <TD className="text-sm">{b.review ? `${b.review.rating}/5` : "—"}</TD>
                    <TD className="text-sm capitalize">{b.status.replace("_", " ")}</TD>
                    <TD className="text-right">
                      <Button type="button" variant="ghost" className="text-xs" onClick={() => {
                        setActive(b);
                        setNotes(b.notes ?? "");
                      }}>
                        Manage
                      </Button>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </div>
      )}

      {canViewAppointments === true ? (
        <p className="text-xs text-zinc-800">
          Click any slot to view who booked and manage status/notes.
        </p>
      ) : null}

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment</DialogTitle>
          </DialogHeader>
          {active ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-zinc-800">Customer:</span> {active.customer_name} ({active.customer_mobile})
              </p>
              <p>
                <span className="text-zinc-800">Service:</span> {active.service.name}
              </p>
              <p>
                <span className="text-zinc-800">Staff:</span> {active.staff.name}
              </p>
              <p>
                <span className="text-zinc-800">Customer rating:</span>{" "}
                {active.review ? `${active.review.rating}/5${active.review.comment ? ` - ${active.review.comment}` : ""}` : "No rating yet"}
              </p>
              <div className="rounded-xl border border-zinc-100 p-3 text-xs dark:border-zinc-800">
                <p className="font-semibold uppercase tracking-wide text-zinc-800">Customer fraud/risk check</p>
                {riskBusy ? (
                  <p className="mt-1 text-zinc-800">Loading profile…</p>
                ) : riskProfile ? (
                  <>
                    <p className="mt-1">
                      Completed: <strong>{riskProfile.completed}</strong> · Cancelled: <strong>{riskProfile.cancelled}</strong> · No-show:{" "}
                      <strong>{riskProfile.no_show}</strong>
                    </p>
                    <p>
                      Total bookings: <strong>{riskProfile.total_bookings}</strong> · Cancel ratio:{" "}
                      <strong>{riskProfile.cancellation_rate_percent}%</strong>
                    </p>
                    <p>
                      Risk level:{" "}
                      <strong className={riskProfile.risk_level === "high" ? "text-red-600" : riskProfile.risk_level === "medium" ? "text-amber-600" : "text-emerald-600"}>
                        {riskProfile.risk_level}
                      </strong>
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-zinc-800">No profile data.</p>
                )}
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" className="mt-1" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
          ) : null}
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="text-xs" disabled={busy} onClick={() => void saveStatus("confirmed")}>
                Mark confirmed
              </Button>
              <Button type="button" variant="outline" className="text-xs" disabled={busy} onClick={() => void saveStatus("completed")}>
                Mark completed
              </Button>
              <Button type="button" variant="outline" className="text-xs" disabled={busy} onClick={() => void saveStatus("cancelled")}>
                Cancel
              </Button>
              <Button type="button" variant="outline" className="text-xs" disabled={busy} onClick={() => void saveStatus("no_show")}>
                No-show
              </Button>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setActive(null)}>
                Close
              </Button>
              <Button type="button" disabled={busy} onClick={() => void saveNotes()}>
                Save notes
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ShopAppointmentsPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <FormBody accessToken={token} />}
    </SalonManagementGate>
  );
}
