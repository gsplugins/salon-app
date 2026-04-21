"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatApiError } from "@/lib/auth-api";
import { formatMoneyCents, formatStaffDate } from "@/lib/staff-ui";
import { fetchStaffEarningsSummary, type StaffEarningsSummary } from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function downloadCsv(filename: string, rows: string[][]) {
  const esc = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const body = rows.map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StaffEarningsClient() {
  const token = useSalonAccessToken();
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<StaffEarningsSummary | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const res = await fetchStaffEarningsSummary(token, { from, to });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token, from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const byDay = new Map<string, number>();
    for (const row of data.breakdown) {
      const day = new Date(row.starts_at).toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + row.commission_cents);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([day, commission_cents]) => ({
        day,
        label: formatStaffDate(`${day}T12:00:00`),
        commission_cents,
      }));
  }, [data]);

  function exportCsv() {
    if (!data) return;
    const header = ["Date", "Customer", "Service", "Price (USD)", "Commission (USD)", "Status"];
    const rows: string[][] = [header];
    for (const b of data.breakdown) {
      rows.push([
        new Date(b.starts_at).toISOString(),
        b.customer_name,
        b.service_name ?? "",
        (b.price_cents / 100).toFixed(2),
        (b.commission_cents / 100).toFixed(2),
        b.commission_status,
      ]);
    }
    downloadCsv(`staff-earnings-${from}_to_${to}.csv`, rows);
    toast.success("CSV downloaded.");
  }

  if (!token) return null;

  if (busy || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Earnings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Commission from completed appointments in the selected range.</p>
      </div>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Commission rate</CardTitle>
        </CardHeader>
        <CardContent className="text-2xl font-bold text-zinc-900 dark:text-white">
          {data.commission_percent != null && String(data.commission_percent) !== "" ? `${data.commission_percent}%` : "—"}
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">This week (est.)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatMoneyCents(data.this_week_commission_cents_estimate)}</CardContent>
        </Card>
        <Card className="border-zinc-200/80 dark:border-zinc-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">This month (est.)</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold">{formatMoneyCents(data.this_month_commission_cents_estimate)}</CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="from">From</Label>
          <Input id="from" type="date" className="mt-1 min-h-11" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" className="mt-1 min-h-11" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button type="button" variant="outline" className="min-h-11" onClick={() => void load()}>
          Apply
        </Button>
        <Button type="button" className="min-h-11" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>

      <Card className="border-zinc-200/80 dark:border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Commission by day</CardTitle>
        </CardHeader>
        <CardContent className="h-64 w-full">
          {chartData.length === 0 ? (
            <p className="text-sm text-zinc-500">No completed bookings in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-zinc-200 dark:stroke-zinc-800" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={(v) => `$${(v / 100).toFixed(0)}`} width={48} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: number) => [formatMoneyCents(value), "Commission"]}
                  labelFormatter={(_, payload) => (payload[0] ? String(payload[0].payload.day) : "")}
                />
                <Bar dataKey="commission_cents" fill="#be123c" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Breakdown</h2>
        <p className="text-xs text-zinc-500">Range total: {formatMoneyCents(data.range.total_commission_cents)}</p>
        <ul className="mt-3 space-y-2">
          {data.breakdown.length === 0 ? (
            <li className="text-sm text-zinc-500">No rows.</li>
          ) : (
            data.breakdown.map((b) => (
              <li
                key={b.booking_id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-zinc-100 px-3 py-2 text-sm dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">{b.customer_name}</p>
                  <p className="text-xs text-zinc-500">
                    {formatStaffDate(b.starts_at)} · {b.service_name ?? "Service"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-zinc-900 dark:text-white">{formatMoneyCents(b.commission_cents)}</p>
                  <p className="text-[10px] uppercase text-zinc-500">{b.commission_status}</p>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
