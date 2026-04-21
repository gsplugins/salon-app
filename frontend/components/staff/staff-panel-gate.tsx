"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import {
  canAccessCustomerPortal,
  canAccessSalonManagement,
  canOpenStaffPortal,
  isShopOwnerLike,
} from "@/lib/role-access";
import { useSalonAccessTokenReady } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";

export function StaffPanelGate(props: { children: (accessToken: string) => React.ReactNode }) {
  const { token, ready } = useSalonAccessTokenReady();
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- RBAC hydrate
    void load();
  }, [load]);

  if (!ready || me === undefined) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-32 w-full max-w-md" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Sign in required</p>
          <p className="mt-1 opacity-90">Staff portal uses the same salon login as your mobile account.</p>
          <Link
            href="/app"
            className="mt-4 inline-flex min-h-11 items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
          >
            Open /app
          </Link>
        </div>
      </div>
    );
  }

  if (!me || !canOpenStaffPortal(me)) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-2xl border border-sky-200 bg-sky-50 p-6 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-100">
          <p className="font-medium">Staff portal</p>
          <p className="mt-2 leading-relaxed opacity-95">
            {me && canAccessCustomerPortal(me) ? (
              <>This area is for salon team accounts. Customers use the customer portal for bookings.</>
            ) : (
              <>This area is for stylists, shop owners, managers, and platform admins.</>
            )}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            {me && canAccessCustomerPortal(me) ? (
              <Link
                href="/customer/dashboard"
                className="inline-flex min-h-11 items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
              >
                Customer portal
              </Link>
            ) : null}
            {me && canAccessSalonManagement(me) && !canAccessCustomerPortal(me) ? (
              <Link
                href="/owner/dashboard"
                className="inline-flex min-h-11 items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
              >
                Salon dashboard
              </Link>
            ) : null}
            <Link href="/app" className="inline-flex min-h-11 items-center text-sm font-medium text-rose-800 underline dark:text-rose-200">
              Switch account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <>{props.children(token)}</>;
}
