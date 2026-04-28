"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { canAccessSuperAdmin } from "@/lib/role-access";
import { useSalonAccessTokenReady } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";

export function SuperAdminGate(props: { children: (accessToken: string) => React.ReactNode }) {
  const { token, ready } = useSalonAccessTokenReady();
  const [me, setMe] = useState<AuthMePayload | null | undefined>(undefined);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const load = useCallback(async () => {
    if (!token) {
      setMe(null);
      setVerifyError(null);
      return;
    }
    const res = await fetchAuthMe(token);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        setMe(null);
        setVerifyError(null);
        return;
      }
      if (retryCount < 2) {
        setTimeout(() => setRetryCount((n) => n + 1), 450);
        return;
      }
      setVerifyError("We could not verify permissions yet. Please retry.");
      return;
    }
    setVerifyError(null);
    setMe(res.data);
  }, [token, retryCount]);

  useEffect(() => {
     
    void load();
  }, [load, retryCount]);

  if (!ready || me === undefined) {
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
        <p className="mt-1 opacity-90">Platform admin tools need a super admin account.</p>
        <Link
          href="/app"
          className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
        >
          Open /app
        </Link>
      </div>
    );
  }

  if (verifyError) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">{verifyError}</p>
        <button
          type="button"
          onClick={() => {
            setRetryCount(0);
            setMe(undefined);
            setVerifyError(null);
          }}
          className="mt-4 inline-flex rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold dark:border-zinc-600"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!me) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">Session verification needed</p>
        <p className="mt-1 opacity-90">
          We could not confirm your admin session yet. Please open <strong>/app</strong> and sign in again if needed.
        </p>
        <Link
          href="/app"
          className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
        >
          Open /app
        </Link>
      </div>
    );
  }

  if (!canAccessSuperAdmin(me)) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-950 dark:border-red-900 dark:bg-red-950/30 dark:text-red-100">
        <p className="font-medium">Access denied</p>
        <p className="mt-2 leading-relaxed opacity-95">
          This section is only for <strong>platform super administrators</strong>.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/owner/dashboard" className="text-sm font-medium text-rose-800 underline dark:text-rose-200">
            Shop owner dashboard
          </Link>
          <Link href="/customer/dashboard" className="text-sm font-medium text-rose-800 underline dark:text-rose-200">
            Customer dashboard
          </Link>
        </div>
      </div>
    );
  }

  return <>{props.children(token)}</>;
}
