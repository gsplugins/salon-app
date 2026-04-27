"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { formatApiError } from "@/lib/auth-api";
import { SHOP_BUSINESS_DAYS, type DayHoursState, hoursFromSettings } from "@/lib/shop-business-hours";
import { formatStaffDate, formatStaffDateTime, formatStaffTime } from "@/lib/staff-ui";
import { createStaffLeaveRequest, fetchStaffSchedule, type StaffSchedulePayload } from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

const leaveSchema = z.object({
  date: z.string().min(1, "Pick a date"),
  reason: z.string().min(3, "Add a short reason"),
});

type LeaveForm = z.infer<typeof leaveSchema>;

/** Same shape as shop business hours: mon..sun with closed / open / close. */
function dayScheduleFromObject(raw: unknown, useDefaultsForMissing: boolean): DayHoursState {
  const out: DayHoursState = {} as DayHoursState;
  const bh = raw && typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : null;
  for (const { key } of SHOP_BUSINESS_DAYS) {
    const day = bh && typeof bh[key] === "object" && bh[key] !== null ? (bh[key] as Record<string, unknown>) : null;
    if (day && day.closed) {
      out[key] = { closed: true, open: "09:00", close: "18:00" };
    } else if (day && typeof day.open === "string" && typeof day.close === "string") {
      out[key] = { closed: false, open: day.open.slice(0, 5), close: day.close.slice(0, 5) };
    } else if (useDefaultsForMissing) {
      out[key] = { closed: false, open: "09:00", close: "18:00" };
    } else {
      out[key] = { closed: false, open: "", close: "" };
    }
  }
  return out;
}

function formatDayLine(d: { closed: boolean; open: string; close: string }): string {
  if (d.closed) return "Closed";
  if (d.open && d.close) return `${d.open} – ${d.close}`;
  return "—";
}

type HolidayItem = { date: string; note: string };

function parseHolidays(raw: unknown): HolidayItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const o = row as Record<string, unknown>;
      const date = typeof o.date === "string" ? o.date : "";
      const note = typeof o.note === "string" ? o.note : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
      return { date, note };
    })
    .filter(Boolean) as HolidayItem[];
}

function leaveStatusClass(status: string): string {
  switch (status) {
    case "approved":
      return "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
    case "rejected":
    case "denied":
      return "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100";
    case "pending":
    default:
      return "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
  }
}

function ScheduleHoursTable(props: { title: string; caption?: string; hours: DayHoursState }) {
  return (
    <Card className="border-zinc-200/80 dark:border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{props.title}</CardTitle>
        {props.caption ? <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400">{props.caption}</p> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[280px] text-left text-sm">
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {SHOP_BUSINESS_DAYS.map(({ key, label }) => (
                <tr key={key}>
                  <th className="w-[36%] py-2 pr-3 font-medium text-zinc-700 dark:text-zinc-300">{label}</th>
                  <td className="py-2 text-zinc-900 dark:text-zinc-100">{formatDayLine(props.hours[key])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export function StaffScheduleClient() {
  const token = useSalonAccessToken();
  const [data, setData] = useState<StaffSchedulePayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Set when schedule payload is received so block split is pure (no `Date.now` in render). */
  const [blocksAsOfMs, setBlocksAsOfMs] = useState(0);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    setLoadError(null);
    const res = await fetchStaffSchedule(token);
    setBusy(false);
    if (!res.ok) {
      const msg = formatApiError(res.body);
      setLoadError(msg);
      toast.error(msg);
      setData(null);
      return;
    }
    setBlocksAsOfMs(Date.now());
    setData(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema) as Resolver<LeaveForm>,
    defaultValues: { date: "", reason: "" },
  });

  const shopDayHours = useMemo(() => {
    if (!data) return null;
    return hoursFromSettings({ business_hours: data.shop_business_hours } as Record<string, unknown>);
  }, [data]);

  const myTemplateHours = useMemo(() => {
    if (!data) return null;
    return dayScheduleFromObject(data.weekly_schedule, false);
  }, [data]);

  const holidays = useMemo(() => (data ? parseHolidays(data.shop_holidays) : []), [data]);

  const { upcomingBlocks, pastBlocks } = useMemo(() => {
    if (!data || !blocksAsOfMs) {
      return { upcomingBlocks: [] as StaffSchedulePayload["availability_blocks"], pastBlocks: [] as StaffSchedulePayload["availability_blocks"] };
    }
    const now = blocksAsOfMs;
    const u: typeof data.availability_blocks = [];
    const p: typeof data.availability_blocks = [];
    for (const b of data.availability_blocks) {
      const end = new Date(b.ends_at).getTime();
      if (end >= now) u.push(b);
      else p.push(b);
    }
    u.sort((a, b) => new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime());
    p.sort((a, b) => new Date(b.starts_at).getTime() - new Date(a.starts_at).getTime());
    return { upcomingBlocks: u, pastBlocks: p };
  }, [data, blocksAsOfMs]);

  async function onLeaveSubmit(values: LeaveForm) {
    if (!token) return;
    const res = await createStaffLeaveRequest(token, { date: values.date, reason: values.reason });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Leave request sent to your manager.");
    form.reset({ date: "", reason: "" });
    void load();
  }

  if (!token) return null;

  if (busy && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (loadError && !data) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Schedule</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Could not load your schedule.</p>
        </div>
        <Card className="border-red-200/80 dark:border-red-900/50">
          <CardContent className="p-4 text-sm text-red-800 dark:text-red-200">{loadError}</CardContent>
        </Card>
        <Button type="button" variant="outline" onClick={() => void load()} className="min-h-11 gap-2">
          <RefreshCw className="h-4 w-4" />
          Try again
        </Button>
      </div>
    );
  }

  if (!data || !shopDayHours || !myTemplateHours) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Schedule</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Shop hours, your weekly template, time off, and personal blocks. Edit live availability in Availability.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-9 gap-1.5"
          disabled={busy}
          onClick={() => void load()}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ScheduleHoursTable
          title="Your weekly template"
          caption="Default hours your manager set for you. Bookings may still respect shop hours and holidays."
          hours={myTemplateHours}
        />
        <ScheduleHoursTable
          title="Shop business hours"
          caption="When the shop is open to clients."
          hours={shopDayHours}
        />
      </div>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Shop holidays</CardTitle>
          <p className="text-sm font-normal text-zinc-500 dark:text-zinc-400">Days the business may be closed or limited.</p>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-sm text-zinc-500">No holidays configured.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {holidays.map((h) => (
                <li
                  key={h.date}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-800"
                >
                  <span className="font-medium text-zinc-900 dark:text-white">{formatStaffDate(h.date)}</span>
                  {h.note ? <span className="text-zinc-600 dark:text-zinc-400">{h.note}</span> : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Leave requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2 text-sm">
            {data.leave_requests.length === 0 ? (
              <li className="text-zinc-500">No requests yet.</li>
            ) : (
              data.leave_requests.map((r) => (
                <li key={r.id} className="rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-zinc-900 dark:text-white">{formatStaffDate(r.date)}</span>
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-semibold uppercase ${leaveStatusClass(r.status)}`}
                    >
                      {r.status}
                    </span>
                  </div>
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{r.reason}</p>
                  {r.manager_note ? <p className="mt-1 text-xs text-zinc-500">Manager: {r.manager_note}</p> : null}
                </li>
              ))
            )}
          </ul>

          <form className="space-y-3 border-t border-zinc-100 pt-4 dark:border-zinc-800" onSubmit={form.handleSubmit(onLeaveSubmit)}>
            <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Request a day off</p>
            <div>
              <Label htmlFor="leave-date">Date</Label>
              <Input id="leave-date" type="date" className="mt-1 min-h-11" {...form.register("date")} />
              {form.formState.errors.date ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.date.message}</p>
              ) : null}
            </div>
            <div>
              <Label htmlFor="leave-reason">Reason</Label>
              <Textarea id="leave-reason" className="mt-1 min-h-[88px]" {...form.register("reason")} />
              {form.formState.errors.reason ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.reason.message}</p>
              ) : null}
            </div>
            <Button type="submit" className="min-h-11 w-full sm:w-auto" disabled={form.formState.isSubmitting}>
              Submit request
            </Button>
          </form>
        </CardContent>
      </Card>

      {upcomingBlocks.length > 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Upcoming personal blocks</CardTitle>
            <p className="text-sm font-normal text-zinc-500">Times you are marked unavailable (from Availability).</p>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {upcomingBlocks.map((b) => (
                <li key={b.id} className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div className="font-medium text-zinc-900 dark:text-white">
                    {formatStaffDateTime(b.starts_at)} – {formatStaffTime(b.ends_at)}
                  </div>
                  <div className="mt-0.5 text-xs text-zinc-500">
                    {b.kind}
                    {b.note ? ` · ${b.note}` : null}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {pastBlocks.length > 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Past blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
              {pastBlocks.slice(0, 20).map((b) => (
                <li key={b.id} className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  {formatStaffDateTime(b.starts_at)} – {formatStaffTime(b.ends_at)}
                  {b.kind ? <span className="ml-2 text-xs">({b.kind})</span> : null}
                </li>
              ))}
              {pastBlocks.length > 20 ? (
                <li className="text-xs text-zinc-500">And {pastBlocks.length - 20} more…</li>
              ) : null}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
