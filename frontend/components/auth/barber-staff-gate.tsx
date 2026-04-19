"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { canAccessBarberStaffRoutes, canAccessSuperAdmin, isShopOwnerLike } from "@/lib/role-access";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Stylist schedule & history (`/my/barber/*`) — requires role `barber` with a staff profile on the API.
 * Shop owners should use Owner dashboard + /app calendar instead.
 */
export function BarberStaffGate(props: { children: (accessToken: string) => React.ReactNode }) {
  const token = useSalonAccessToken();
  const [me, setMe] = useState<AuthMePayload | null | undefined>(undefined);

  const load = useCallback(async () => {
    if (!token) {
      setMe(null);
      return;
    }
    const res = await fetchAuthMe(token);
    if (!res.ok) {
      setMe(null);
      return;
    }
    setMe(res.data);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load session for RBAC
    void load();
  }, [load]);

  if (token === null || me === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Sign in required</p>
        <p className="mt-1 opacity-90">Stylist tools use a staff barber account linked to your shop.</p>
        <Link
          href="/app"
          className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          Open /app
        </Link>
      </div>
    );
  }

  if (!me) {
    return null;
  }

  if (canAccessSuperAdmin(me)) {
    return (
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 text-sm text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-200">
        <p className="font-medium">Platform administrator</p>
        <p className="mt-2 leading-relaxed opacity-95">
          The stylist schedule API is for <strong>barber staff</strong> accounts. Use platform admin or sign in as a
          stylist to preview this view.
        </p>
        <Link
          href="/admin/dashboard"
          className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          Platform admin
        </Link>
      </div>
    );
  }

  if (isShopOwnerLike(me)) {
    return (
      <div className="rounded-2xl border border-violet-200 bg-violet-50 p-6 text-sm text-violet-950 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-100">
        <p className="font-medium">Shop owner account</p>
        <p className="mt-2 leading-relaxed opacity-95">
          This page is for <strong>stylist staff</strong> (barber role with a staff profile). As the shop owner, use your
          salon dashboard and the full calendar for scheduling and the walk-in queue.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/owner/dashboard"
            className="inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
          >
            Owner dashboard
          </Link>
          <Link
            href="/app"
            className="inline-flex rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600"
          >
            Calendar &amp; bookings
          </Link>
        </div>
      </div>
    );
  }

  if (!canAccessBarberStaffRoutes(me)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Stylist access only</p>
        <p className="mt-2 leading-relaxed opacity-95">
          Signed-in as <strong>{me.role}</strong>. This schedule is for salon stylists (barber staff accounts).
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/dashboard" className="text-sm font-medium text-rose-800 underline dark:text-rose-200">
            Customer dashboard
          </Link>
          <Link href="/owner/dashboard" className="text-sm font-medium text-rose-800 underline dark:text-rose-200">
            Salon dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{props.children(token)}</>;
}
