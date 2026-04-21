"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { formatApiError } from "@/lib/auth-api";
import { formatStaffDate } from "@/lib/staff-ui";
import { createStaffLeaveRequest, fetchStaffSchedule, type StaffSchedulePayload } from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const leaveSchema = z.object({
  date: z.string().min(1, "Pick a date"),
  reason: z.string().min(3, "Add a short reason"),
});

type LeaveForm = z.infer<typeof leaveSchema>;

function JsonBlock(props: { title: string; value: unknown }) {
  return (
    <Card className="border-zinc-200/80 dark:border-zinc-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{props.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <pre className="max-h-64 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
          {props.value == null ? "—" : JSON.stringify(props.value, null, 2)}
        </pre>
      </CardContent>
    </Card>
  );
}

export function StaffScheduleClient() {
  const token = useSalonAccessToken();
  const [data, setData] = useState<StaffSchedulePayload | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const res = await fetchStaffSchedule(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const form = useForm<LeaveForm>({
    resolver: zodResolver(leaveSchema) as Resolver<LeaveForm>,
    defaultValues: { date: "", reason: "" },
  });

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

  if (busy || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Schedule</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Hours from your manager, your time off requests, and blocked slots.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <JsonBlock title="Your weekly template" value={data.weekly_schedule} />
        <JsonBlock title="Shop business hours" value={data.shop_business_hours} />
      </div>
      <JsonBlock title="Shop holidays" value={data.shop_holidays} />

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
                  <span className="font-medium text-zinc-900 dark:text-white">{formatStaffDate(r.date)}</span>
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold uppercase text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {r.status}
                  </span>
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

      {data.availability_blocks.length > 0 ? (
        <Card className="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Upcoming personal blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              {data.availability_blocks.map((b) => (
                <li key={b.id} className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  {b.starts_at} → {b.ends_at}
                  {b.note ? <span className="block text-xs text-zinc-500">{b.note}</span> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
