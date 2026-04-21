"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/auth-api";
import { formatMoneyCents } from "@/lib/staff-ui";
import { fetchStaffServices, type StaffServiceRow } from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function StaffServicesClient() {
  const token = useSalonAccessToken();
  const [rows, setRows] = useState<StaffServiceRow[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchStaffServices(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;

  if (rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Services</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Services assigned to you — read-only. Pricing is controlled by your manager.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {rows.length === 0 ? (
          <li className="col-span-full rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No services linked to your profile.
          </li>
        ) : (
          rows.map((s) => (
            <li key={s.id}>
              <Card className="h-full border-zinc-200/80 dark:border-zinc-800">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                  <p>
                    {s.duration_minutes} minutes
                    {s.price_cents != null ? ` · ${formatMoneyCents(s.price_cents)}` : ""}
                  </p>
                  {s.category ? <p className="text-xs uppercase tracking-wide text-zinc-500">{s.category}</p> : null}
                  <div>
                    <p className="text-xs font-semibold text-zinc-500">Description / instructions</p>
                    <p className="mt-1 text-zinc-700 dark:text-zinc-300">{s.description?.trim() ? s.description : "—"}</p>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
