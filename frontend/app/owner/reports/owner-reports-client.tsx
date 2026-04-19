"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOwnerAnalyticsSummary, formatApiError, type OwnerAnalyticsSummary } from "@/lib/salon-api";

function downloadCsv(summary: OwnerAnalyticsSummary) {
  const lines = [
    ["metric", "value"],
    ["from", summary.from],
    ["to", summary.to],
    ["total_bookings", String(summary.total_bookings)],
    ["revenue_cents_completed", String(summary.revenue_cents_completed)],
    ...Object.entries(summary.by_status).map(([k, v]) => [`status_${k}`, String(v)]),
    ...summary.top_services.map((s, i) => [`top_service_${i + 1}`, `${s.name}:${s.bookings}`]),
  ];
  const blob = new Blob([lines.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `salon-report-${summary.from.slice(0, 10)}-${summary.to.slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast.success("Export started.");
}

function Body({ token }: { token: string }) {
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
  }, []);

  const [data, setData] = useState<OwnerAnalyticsSummary | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchOwnerAnalyticsSummary(token, range.from, range.to);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token, range.from, range.to]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load analytics
    void load();
  }, [load]);

  if (busy) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!data) {
    return <p className="text-sm text-zinc-600">Could not load analytics.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Reports</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Range: {data.from.slice(0, 10)} → {data.to.slice(0, 10)}
          </p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(data)}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-500">Bookings</p>
          <p className="mt-2 text-3xl font-semibold">{data.total_bookings}</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-sm text-zinc-500">Revenue (completed)</p>
          <p className="mt-2 text-3xl font-semibold">
            {new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(
              data.revenue_cents_completed / 100
            )}
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Top services</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {data.top_services.map((s) => (
            <li key={s.name} className="flex justify-between border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800">
              <span>{s.name}</span>
              <span className="font-medium">{s.bookings} bookings</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export function OwnerReportsClient() {
  return (
    <SalonManagementGate>{(token) => <Body token={token} />}</SalonManagementGate>
  );
}
