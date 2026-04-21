"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOwnerAnalyticsSummary, formatApiError, type OwnerAnalyticsSummary } from "@/lib/salon-api";

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function Body({ accessToken }: { accessToken: string }) {
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 27);
    return iso(d);
  });
  const [to, setTo] = useState(() => iso(new Date()));
  const [data, setData] = useState<OwnerAnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchOwnerAnalyticsSummary(accessToken, from, to);
    setLoading(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setData(res.data);
  }, [accessToken, from, to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load analytics when range changes
    void load();
  }, [load]);

  const barData = useMemo(() => {
    if (!data) return [];
    const top = (data.top_services ?? []).slice(0, 6).map((s) => ({ name: s.name, bookings: s.bookings }));
    return top;
  }, [data]);

  const compareData = useMemo(() => {
    if (!data?.comparison) return [];
    return [
      { label: "This range", bookings: data.total_bookings, revenue: Math.round(data.revenue_cents_completed / 100) },
      {
        label: "Prior range",
        bookings: data.comparison.total_bookings,
        revenue: Math.round(data.comparison.revenue_cents_completed / 100),
      },
    ];
  }, [data]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <div>
          <Label htmlFor="af">From</Label>
          <Input id="af" type="date" className="mt-1 w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="at">To</Label>
          <Input id="at" type="date" className="mt-1 w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Apply
        </Button>
      </div>

      {loading || !data ? (
        <Skeleton className="h-72 w-full rounded-2xl" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Bookings</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{data.total_bookings}</p>
              {data.comparison ? (
                <p className="mt-1 text-xs text-zinc-500">
                  Prior: {data.comparison.total_bookings}{" "}
                  {data.comparison.total_bookings
                    ? `(${Math.round(((data.total_bookings - data.comparison.total_bookings) / data.comparison.total_bookings) * 100)}%)`
                    : ""}
                </p>
              ) : null}
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Revenue (completed)</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                {(data.revenue_cents_completed / 100).toLocaleString(undefined, { style: "currency", currency: "BDT" })}
              </p>
            </div>
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Cancel + no-show rate</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">
                {data.cancellation_rate_percent != null ? `${data.cancellation_rate_percent}%` : "—"}
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Top services (bookings)</h2>
            <div className="mt-4 h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="bookings" fill="#e11d48" radius={[4, 4, 0, 0]} name="Bookings" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Comparison vs previous period</h2>
            <div className="mt-4 h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={compareData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="bookings" stroke="#18181b" strokeWidth={2} name="Bookings" />
                  <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#f43f5e" strokeWidth={2} name="Revenue (major units)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {data.top_staff && data.top_staff.length > 0 ? (
            <section className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Top staff</h2>
              <ul className="mt-3 divide-y divide-zinc-100 dark:divide-zinc-800">
                {data.top_staff.map((s) => (
                  <li key={s.name} className="flex justify-between py-2 text-sm">
                    <span>{s.name}</span>
                    <span className="text-zinc-500">{s.bookings} bookings</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

export function ShopAnalyticsPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <Body accessToken={token} />}
    </SalonManagementGate>
  );
}
