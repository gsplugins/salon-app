"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { canAccessSalonManagement } from "@/lib/role-access";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";

export function SalonManagementGate(props: { children: (accessToken: string) => React.ReactNode }) {
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
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Sign in required</p>
        <p className="mt-1 opacity-90">Salon management is for shop owners and staff.</p>
        <Link
          href="/app"
          className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          Sign in at /app
        </Link>
      </div>
    );
  }

  if (!me || !canAccessSalonManagement(me)) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Salon tools not available for this account</p>
        <p className="mt-2 leading-relaxed opacity-95">
          This area is for <strong>shop owners</strong>, <strong>salon staff</strong>, and <strong>platform admins</strong>.
          Customer accounts can book appointments and manage visits from the links below.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href="/customer/dashboard"
            className="inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
          >
            My bookings &amp; loyalty
          </Link>
          <Link
            href="/shops"
            className="inline-flex rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600"
          >
            Browse shops
          </Link>
          <Link href="/app" className="inline-flex text-sm font-medium text-rose-800 underline dark:text-rose-200">
            Use a different account
          </Link>
        </div>
      </div>
    );
  }

  return <>{props.children(token)}</>;
}
