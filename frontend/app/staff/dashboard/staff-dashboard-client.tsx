"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Clock, Coins, ToggleLeft } from "lucide-react";
import { formatApiError } from "@/lib/auth-api";
import { formatMoneyCents, formatStaffDateTime } from "@/lib/staff-ui";
import {
  fetchStaffDashboard,
  patchStaffAvailabilityStatus,
  type StaffDashboardPayload,
} from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StaffDashboardClient() {
  const token = useSalonAccessToken();
  const [data, setData] = useState<StaffDashboardPayload | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const res = await fetchStaffDashboard(token);
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

  async function setAvailability(status: string) {
    if (!token) return;
    const res = await patchStaffAvailabilityStatus(token, status);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Availability updated.");
    void load();
  }

  if (!token) return null;

  if (busy || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-sm" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const next = data.next_appointment;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Hello, {data.staff.name}</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Here is your shift at a glance.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="h-4 w-4 text-rose-700 dark:text-rose-300" />
              Today&apos;s bookings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">{data.today_appointment_count}</p>
            <p className="mt-1 text-xs text-zinc-500">Appointments scheduled for today</p>
          </CardContent>
        </Card>
        <Card className="border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Coins className="h-4 w-4 text-rose-700 dark:text-rose-300" />
              Today&apos;s commission (est.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">
              {formatMoneyCents(data.today_commission_cents_estimate)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">Based on completed services and your rate</p>
          </CardContent>
        </Card>
      </div>

      <Card className="border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Next booking</CardTitle>
        </CardHeader>
        <CardContent>
          {next ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">{next.customer_name}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {next.service?.name ?? "Service"} · {formatStaffDateTime(next.starts_at)}
                </p>
              </div>
              <Button asChild variant="outline" className="min-h-11 shrink-0">
                <Link href="/staff/appointments">View schedule</Link>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No upcoming appointment on file.</p>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-zinc-800 dark:text-zinc-200">
          <ToggleLeft className="h-4 w-4" />
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-11" onClick={() => void setAvailability("available")}>
            Mark available
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void setAvailability("on_leave")}>
            Mark on leave
          </Button>
          <Button asChild variant="outline" className="min-h-11">
            <Link href="/staff/appointments" className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Full schedule
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
