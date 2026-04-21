"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAdminAnalyticsSummary, formatApiError } from "@/lib/admin-api";

function Body({ token }: { token: string }) {
  const [d, setD] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetchAdminAnalyticsSummary(token);
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        return;
      }
      setD(res.data);
    })();
  }, [token]);

  if (!d) {
    return (
      <AdminWorkspaceFrame title="Analytics" subtitle="Platform KPIs.">
        <Skeleton className="h-40 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  const top = (d.top_shops_by_bkash as { id: number; name: string; slug: string; revenue_paisa: string | number }[]) ?? [];

  return (
    <AdminWorkspaceFrame
      title="Analytics"
      subtitle="Approximate MRR from monthly catalog plans and bKash totals. Extend with charts when a charting library is added."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Shops</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {String(d.shops_active ?? "—")} / {String(d.shops_total ?? "—")} active
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Active subscriptions</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{String(d.active_subscriptions ?? "—")}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">MRR (plan table, monthly)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {((Number(d.mrr_cents_approx ?? 0) / 100).toFixed(2))} minor units
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">Signups 7d / 30d</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {String(d.signups_last_7_days ?? "—")} / {String(d.signups_last_30_days ?? "—")}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-zinc-500">bKash revenue (completed)</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">
            {(Number(d.bkash_revenue_paisa_total ?? 0) / 100).toFixed(2)} BDT
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Top shops by bKash</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {top.map((s) => (
              <li key={s.id} className="flex justify-between gap-4 border-b border-zinc-100 py-2 last:border-0 dark:border-zinc-800">
                <span className="font-medium">{s.name}</span>
                <span className="text-zinc-500">{(Number(s.revenue_paisa) / 100).toFixed(2)} BDT</span>
              </li>
            ))}
            {top.length === 0 ? <li className="text-zinc-500">No completed bKash payments yet.</li> : null}
          </ul>
        </CardContent>
      </Card>
    </AdminWorkspaceFrame>
  );
}

export function AdminAnalyticsClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
