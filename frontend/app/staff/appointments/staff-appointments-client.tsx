"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Clock, MoreHorizontal, Phone, User, X } from "lucide-react";
import { formatApiError } from "@/lib/auth-api";
import {
  bookingStatusLabel,
  formatStaffDateTime,
  isAppointmentSoon,
  isUpcomingBookingStatus,
} from "@/lib/staff-ui";
import {
  fetchStaffAppointments,
  fetchStaffCustomerRiskProfile,
  patchStaffAppointment,
  postStaffRescheduleRequest,
  type StaffBookingRow,
  type StaffCustomerRiskProfile,
} from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";

const StaffAppointmentsCalendar = dynamic(
  () => import("./staff-appointments-calendar").then((m) => m.StaffAppointmentsCalendar),
  { ssr: false, loading: () => <Skeleton className="h-[480px] w-full rounded-2xl" /> }
);

type FilterKey = "all" | "upcoming" | "completed" | "cancelled" | "no_show";

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function SwipeRow(props: {
  children: React.ReactNode;
  onSwipeRight?: () => void;
  onSwipeLeft?: () => void;
  disabled?: boolean;
}) {
  const startX = useRef<number | null>(null);
  return (
    <div
      className="relative touch-pan-y"
      onTouchStart={(e) => {
        if (props.disabled) return;
        startX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (props.disabled || startX.current === null) return;
        const end = e.changedTouches[0]?.clientX ?? startX.current;
        const dx = end - startX.current;
        startX.current = null;
        if (dx > 70) props.onSwipeRight?.();
        else if (dx < -70) props.onSwipeLeft?.();
      }}
    >
      {props.children}
    </div>
  );
}

export function StaffAppointmentsClient() {
  const token = useSalonAccessToken();
  const [rows, setRows] = useState<StaffBookingRow[] | null>(null);
  const [filter, setFilter] = useState<FilterKey>("upcoming");
  const [detailId, setDetailId] = useState<number | null>(null);
  const [rescheduleMsg, setRescheduleMsg] = useState("");
  const [fabOpen, setFabOpen] = useState(false);
  const [riskProfile, setRiskProfile] = useState<StaffCustomerRiskProfile | null>(null);
  const [riskBusy, setRiskBusy] = useState(false);
  const [rangeDays] = useState(21);

  const from = useMemo(() => ymd(addDays(new Date(), -7)), []);
  const to = useMemo(() => ymd(addDays(new Date(), rangeDays)), [rangeDays]);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchStaffAppointments(token, { from, to });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    if (filter === "all") return rows;
    if (filter === "upcoming") return rows.filter((b) => isUpcomingBookingStatus(b.status));
    return rows.filter((b) => b.status === filter);
  }, [rows, filter]);

  const detail = detailId != null ? rows?.find((b) => b.id === detailId) ?? null : null;

  useEffect(() => {
    async function run() {
      if (!token || !detail) {
        setRiskProfile(null);
        return;
      }
      setRiskBusy(true);
      const res = await fetchStaffCustomerRiskProfile(token, detail.customer_mobile);
      setRiskBusy(false);
      if (!res.ok) {
        setRiskProfile(null);
        return;
      }
      setRiskProfile(res.data);
    }
    void run();
  }, [token, detail]);

  async function markStatus(bookingId: number, status: "completed" | "no_show") {
    if (!token) return;
    const res = await patchStaffAppointment(token, bookingId, { status });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success(status === "completed" ? "Marked completed." : "Marked no-show.");
    setDetailId(null);
    setFabOpen(false);
    void load();
  }

  async function submitReschedule(bookingId: number) {
    if (!token) return;
    const message = rescheduleMsg.trim();
    if (!message) {
      toast.error("Add a short message for your manager.");
      return;
    }
    const res = await postStaffRescheduleRequest(token, bookingId, { message });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Reschedule request sent to manager.");
    setRescheduleMsg("");
    setDetailId(null);
    void load();
  }

  if (!token) return null;

  if (rows === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Appointments</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Calendar and list for your assigned bookings. Swipe a card right to complete, left for no-show. Use the floating
          button for quick status updates on mobile.
        </p>
      </div>

      <Tabs defaultValue="calendar" className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="calendar" className="min-h-11">
            Calendar
          </TabsTrigger>
          <TabsTrigger value="list" className="min-h-11">
            List
          </TabsTrigger>
        </TabsList>
        <TabsContent value="calendar" className="mt-4">
          <StaffAppointmentsCalendar rows={filtered} onSelectBooking={(id) => setDetailId(id)} />
        </TabsContent>
        <TabsContent value="list" className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["upcoming", "Upcoming"],
                ["completed", "Completed"],
                ["cancelled", "Cancelled"],
                ["no_show", "No-show"],
                ["all", "All"],
              ] as const
            ).map(([key, label]) => (
              <Button
                key={key}
                type="button"
                variant={filter === key ? "default" : "outline"}
                className="min-h-11 rounded-full px-3 py-2 text-xs"
                onClick={() => setFilter(key)}
              >
                {label}
              </Button>
            ))}
          </div>
          <ul className="space-y-2">
            {filtered.length === 0 ? (
              <li className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
                No appointments in this view.
              </li>
            ) : (
              filtered.map((b) => {
                const soon = isAppointmentSoon(b.starts_at) && isUpcomingBookingStatus(b.status);
                const canSwipe = isUpcomingBookingStatus(b.status);
                return (
                  <li key={b.id}>
                    <SwipeRow
                      disabled={!canSwipe}
                      onSwipeRight={() => void markStatus(b.id, "completed")}
                      onSwipeLeft={() => void markStatus(b.id, "no_show")}
                    >
                      <button
                        type="button"
                        onClick={() => setDetailId(b.id)}
                        className={cn(
                          "flex w-full min-h-[52px] flex-col gap-1 rounded-2xl border px-4 py-3 text-left transition hover:bg-zinc-50 dark:hover:bg-zinc-900/60",
                          soon
                            ? "border-rose-400 bg-rose-50/80 dark:border-rose-700 dark:bg-rose-950/30"
                            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950/40"
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-zinc-900 dark:text-white">{b.customer_name}</span>
                          {soon ? (
                            <span className="shrink-0 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                              Soon
                            </span>
                          ) : null}
                        </div>
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                          {b.service?.name ?? "Service"} · {formatStaffDateTime(b.starts_at)}
                        </span>
                        <span className="text-xs text-zinc-500">{bookingStatusLabel(b.status)}</span>
                      </button>
                    </SwipeRow>
                  </li>
                );
              })
            )}
          </ul>
        </TabsContent>
      </Tabs>

      <Dialog open={detailId !== null} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
          {detail ? (
            <>
              <DialogHeader>
                <DialogTitle>Appointment</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800">
                    <User className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-semibold text-zinc-900 dark:text-white">{detail.customer_name}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                      <Phone className="h-3.5 w-3.5" />
                      {detail.customer_mobile}
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Service</p>
                  <p className="font-medium text-zinc-900 dark:text-white">{detail.service?.name ?? "—"}</p>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">
                    {detail.service?.duration_minutes ?? "—"} min
                    {detail.service?.price_cents != null ? ` · $${(detail.service.price_cents / 100).toFixed(2)}` : ""}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-100 p-3 dark:border-zinc-800">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Customer risk check</p>
                  {riskBusy ? (
                    <p className="mt-1 text-xs text-zinc-500">Loading profile…</p>
                  ) : riskProfile ? (
                    <div className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">
                      <p>
                        Completed: <strong>{riskProfile.completed}</strong> · Cancelled: <strong>{riskProfile.cancelled}</strong> · No-show:{" "}
                        <strong>{riskProfile.no_show}</strong>
                      </p>
                      <p>
                        Total bookings: <strong>{riskProfile.total_bookings}</strong> · Cancel ratio:{" "}
                        <strong>{riskProfile.cancellation_rate_percent}%</strong>
                      </p>
                      <p className="mt-1">
                        Risk level:{" "}
                        <strong className={riskProfile.risk_level === "high" ? "text-red-600" : riskProfile.risk_level === "medium" ? "text-amber-600" : "text-emerald-600"}>
                          {riskProfile.risk_level}
                        </strong>
                      </p>
                    </div>
                  ) : (
                    <p className="mt-1 text-xs text-zinc-500">No profile data.</p>
                  )}
                </div>
                <div className="flex items-start gap-2 text-zinc-700 dark:text-zinc-300">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                  <div>
                    <p>{formatStaffDateTime(detail.starts_at)}</p>
                    <p className="text-xs text-zinc-500">Status: {bookingStatusLabel(detail.status)}</p>
                  </div>
                </div>
                {detail.notes ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{detail.notes}</p>
                  </div>
                ) : null}
                <div>
                  <Label htmlFor="resched">Request reschedule</Label>
                  <Textarea
                    id="resched"
                    className="mt-1 min-h-[88px]"
                    placeholder="Tell your manager what time would work better…"
                    value={rescheduleMsg}
                    onChange={(e) => setRescheduleMsg(e.target.value)}
                  />
                  <Button type="button" variant="outline" className="mt-2 min-h-11 w-full" onClick={() => void submitReschedule(detail.id)}>
                    Send request to manager
                  </Button>
                  <p className="mt-1 text-xs text-zinc-500">You cannot cancel bookings from here — only your manager can.</p>
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                {isUpcomingBookingStatus(detail.status) ? (
                  <div className="flex w-full flex-col gap-2 sm:flex-row">
                    <Button type="button" className="min-h-11 flex-1" onClick={() => void markStatus(detail.id, "completed")}>
                      <Check className="mr-2 h-4 w-4" />
                      Completed
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      className="min-h-11 flex-1"
                      onClick={() => void markStatus(detail.id, "no_show")}
                    >
                      <X className="mr-2 h-4 w-4" />
                      No-show
                    </Button>
                  </div>
                ) : null}
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Mobile FAB */}
      <button
        type="button"
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-zinc-900 text-white shadow-lg lg:hidden dark:bg-rose-100 dark:text-zinc-900"
        aria-label="Quick appointment actions"
        onClick={() => setFabOpen(true)}
      >
        <MoreHorizontal className="h-6 w-6" />
      </button>

      <Dialog open={fabOpen} onOpenChange={setFabOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Update a booking</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Pick an upcoming booking, then mark completed or no-show.</p>
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {rows
              .filter((b) => isUpcomingBookingStatus(b.status))
              .slice(0, 12)
              .map((b) => (
                <li key={b.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-zinc-100 p-2 dark:border-zinc-800">
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{b.customer_name}</p>
                    <p className="truncate text-xs text-zinc-500">{formatStaffDateTime(b.starts_at)}</p>
                  </div>
                  <Button type="button" className="min-h-10 px-3 py-2 text-xs" onClick={() => void markStatus(b.id, "completed")}>
                    Done
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 px-3 py-2 text-xs"
                    onClick={() => void markStatus(b.id, "no_show")}
                  >
                    No-show
                  </Button>
                </li>
              ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
