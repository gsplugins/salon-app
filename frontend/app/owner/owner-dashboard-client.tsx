"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BarChart3, Calendar } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { ownerShopPath } from "@/lib/owner-shop-paths";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchOwnerAnalyticsSummary,
  fetchShopStats,
  formatApiError,
  type OwnerAnalyticsSummary,
  type ShopStats,
} from "@/lib/salon-api";

function formatMoneyCents(cents: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
  }).format(cents / 100);
}

/** Stats + analytics block (used on `/owner/shop/[slug]` hub and legacy dashboard). */
export function OwnerDashboardOverview({ token, shopSlug }: { token: string; shopSlug?: string }) {
  const [stats, setStats] = useState<ShopStats | null>(null);
  const [analytics, setAnalytics] = useState<OwnerAnalyticsSummary | null>(null);
  const [busy, setBusy] = useState(true);

  const range = useMemo(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 30);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  }, []);

  const load = useCallback(async () => {
    setBusy(true);
    const [s, a] = await Promise.all([
      fetchShopStats(token),
      fetchOwnerAnalyticsSummary(token, range.from, range.to),
    ]);
    setBusy(false);
    if (!s.ok) {
      toast.error(formatApiError(s.body));
      setStats(null);
    } else setStats(s.data);
    if (!a.ok) {
      toast.error(formatApiError(a.body));
      setAnalytics(null);
    } else setAnalytics(a.data);
  }, [token, range.from, range.to]);

  useEffect(() => {
     
    void load();
  }, [load]);

  if (busy || !stats) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800 dark:text-white">Overview</h1>
          <p className="text-sm text-zinc-800 dark:text-zinc-400">
            Live stats for your primary shop. Analytics cover the last 30 days.
          </p>
        </div>
        {shopSlug ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <Link
              href={ownerShopPath(shopSlug, "account")}
              className="font-medium text-rose-800 underline dark:text-rose-200"
            >
              Account
            </Link>
            <Link
              href={ownerShopPath(shopSlug, "settings")}
              className="font-medium text-rose-800 underline dark:text-rose-200"
            >
              Shop preferences
            </Link>
          </div>
        ) : (
          <Link href="/app" className="text-sm font-medium text-rose-800 underline dark:text-rose-200">
            Open account center
          </Link>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 text-zinc-800">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">Today</span>
          </div>
          <p className="mt-3 text-3xl font-semibold text-zinc-800 dark:text-white">
            {stats.bookings_today}
          </p>
          <p className="text-sm text-zinc-800">Bookings today</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-800">This week</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-800 dark:text-white">
            {stats.bookings_this_week}
          </p>
          <p className="text-sm text-zinc-800">Bookings · {stats.completed_this_week} completed</p>
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-800">Est. revenue (week)</p>
          <p className="mt-3 text-3xl font-semibold text-zinc-800 dark:text-white">
            {formatMoneyCents(stats.estimated_revenue_cents_this_week)}
          </p>
          <p className="text-sm text-zinc-800">{stats.pending_upcoming} upcoming</p>
        </div>
      </div>

      {analytics ? (
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 text-zinc-800 dark:text-white">
            <BarChart3 className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Last 30 days</h2>
          </div>
          <p className="mt-1 text-sm text-zinc-800">
            {analytics.from.slice(0, 10)} → {analytics.to.slice(0, 10)}
          </p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm text-zinc-800">Total bookings</dt>
              <dd className="text-2xl font-semibold">{analytics.total_bookings}</dd>
            </div>
            <div>
              <dt className="text-sm text-zinc-800">Revenue (completed)</dt>
              <dd className="text-2xl font-semibold">
                {formatMoneyCents(analytics.revenue_cents_completed)}
              </dd>
            </div>
          </dl>
          <div className="mt-6">
            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">By status</p>
            <ul className="mt-2 flex flex-wrap gap-2 text-sm">
              {Object.entries(analytics.by_status).map(([k, v]) => (
                <li
                  key={k}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {k}: <strong>{v}</strong>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function OwnerDashboardClient() {
  return (
    <SalonManagementGate>{(token) => <OwnerDashboardOverview token={token} />}</SalonManagementGate>
  );
}
