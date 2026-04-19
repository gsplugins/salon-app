"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { canAccessCustomerPortal, canAccessSalonManagement, isShopOwnerLike } from "@/lib/role-access";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomerPortalGate(props: { children: (accessToken: string) => React.ReactNode }) {
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
        <p className="mt-1 opacity-90">Register or log in as a customer to see appointments and loyalty points.</p>
        <Link
          href="/app"
          className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          Open /app
        </Link>
      </div>
    );
  }

  if (!me || !canAccessCustomerPortal(me)) {
    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
        <p className="font-medium">Customer dashboard</p>
        <p className="mt-2 leading-relaxed opacity-95">
          {me && canAccessSalonManagement(me) ? (
            <>
              You are signed in as <strong>{isShopOwnerLike(me) ? "shop owner" : "salon staff"}</strong>. Bookings and
              loyalty on this page are for <strong>customer</strong> accounts only.
            </>
          ) : (
            <>This page is for customer accounts (bookings &amp; loyalty).</>
          )}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {me && canAccessSalonManagement(me) ? (
            <Link
              href="/owner/dashboard"
              className="inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
            >
              Open salon dashboard
            </Link>
          ) : null}
          {me && (me.is_super_admin || me.role === "super_admin") ? (
            <Link
              href="/admin/dashboard"
              className="inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
            >
              Platform admin
            </Link>
          ) : null}
          <Link href="/app" className="inline-flex text-sm font-medium text-rose-800 underline dark:text-rose-200">
            Switch account at /app
          </Link>
        </div>
      </div>
    );
  }

  return <>{props.children(token)}</>;
}
