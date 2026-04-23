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

function FormBody({ accessToken }: { accessToken: string }) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return isoDate(d);
  });
  const [to, setTo] = useState(() => isoDate(new Date()));
  const [status, setStatus] = useState("");
  const [staffId, setStaffId] = useState<string>("");
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [staff, setStaff] = useState<CatalogStaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<BookingRow | null>(null);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [riskProfile, setRiskProfile] = useState<OwnerCustomerRiskProfile | null>(null);
  const [riskBusy, setRiskBusy] = useState(false);

  const loadStaff = useCallback(async () => {
    const res = await fetchStaffCatalog(accessToken);
    if (res.ok) setStaff(res.data);
  }, [accessToken]);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchAdminBookings(accessToken, {
      from: `${from}T00:00:00`,
      to: `${to}T23:59:59`,
      status: status || undefined,
    });
    setLoading(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    let list = res.data;
    if (staffId) {
      const id = Number.parseInt(staffId, 10);
      if (!Number.isNaN(id)) list = list.filter((b) => b.staff.id === id);
    }
    setRows(list);
  }, [accessToken, from, to, status, staffId]);

  useEffect(() => {
     
    void loadStaff();
  }, [loadStaff]);

  useEffect(() => {
     
    void load();
  }, [load]);

  const sorted = useMemo(() => [...rows].sort((a, b) => a.starts_at.localeCompare(b.starts_at)), [rows]);

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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" className="mt-1 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" className="mt-1 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
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
                <TH>Status</TH>
                <TH />
              </TR>
            </THead>
            <TBody>
              {sorted.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="text-center text-sm text-zinc-500">
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
                      <div className="text-xs text-zinc-500">{b.customer_mobile}</div>
                    </TD>
                    <TD className="text-sm">{b.service.name}</TD>
                    <TD className="text-sm">{b.staff.name}</TD>
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

      <p className="text-xs text-zinc-500">
        Drag-and-drop reschedule and FullCalendar views can plug into the same <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">PATCH /my/shop/bookings/:id</code> endpoint.
      </p>

      <Dialog open={active !== null} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Appointment</DialogTitle>
          </DialogHeader>
          {active ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-zinc-500">Customer:</span> {active.customer_name} ({active.customer_mobile})
              </p>
              <p>
                <span className="text-zinc-500">Service:</span> {active.service.name}
              </p>
              <p>
                <span className="text-zinc-500">Staff:</span> {active.staff.name}
              </p>
              <div className="rounded-xl border border-zinc-100 p-3 text-xs dark:border-zinc-800">
                <p className="font-semibold uppercase tracking-wide text-zinc-500">Customer fraud/risk check</p>
                {riskBusy ? (
                  <p className="mt-1 text-zinc-500">Loading profile…</p>
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
                  <p className="mt-1 text-zinc-500">No profile data.</p>
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
