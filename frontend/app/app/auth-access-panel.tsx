"use client";

import Link from "next/link";
import { ArrowRight, LogIn, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { useSalonAccessTokenReady } from "@/hooks/use-salon-access-token";
import { fetchAuthMe } from "@/lib/auth-api";
import { getPrimaryDashboardPath } from "@/lib/auth-session";

export function AuthAccessPanel() {
  const { token, ready } = useSalonAccessTokenReady();
  const [dashboardPath, setDashboardPath] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!token) {
      setDashboardPath(null);
      return;
    }
    void (async () => {
      const res = await fetchAuthMe(token);
      if (!active) return;
      if (!res.ok) {
        setDashboardPath(null);
        return;
      }
      setDashboardPath(getPrimaryDashboardPath(res.data));
    })();
    return () => {
      active = false;
    };
  }, [token]);

  if (!ready) {
    return <aside className="section-wrap p-5" />;
  }

  if (dashboardPath) {
    return (
      <aside className="section-wrap p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
          You are signed in
        </p>
        <h3 className="mt-2 text-lg font-semibold text-white">Continue to your dashboard</h3>
        <p className="mt-2 text-sm text-slate-300">
          Your session is active. Open your role-based workspace directly.
        </p>
        <Link
          href={dashboardPath}
          className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
        >
          Open dashboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </aside>
    );
  }

  return (
    <aside className="section-wrap p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-300">
        Account access
      </p>
      <h3 className="mt-2 text-lg font-semibold text-white">Sign in to continue</h3>
      <p className="mt-2 text-sm text-slate-300">
        If you cannot log in yet, create an account first. This matches a typical real-life barbershop portal flow.
      </p>
      <div className="mt-4 space-y-2">
        <Link
          href="/app/auth?tab=login"
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400"
        >
          <LogIn className="h-4 w-4" />
          Login
        </Link>
        <Link
          href="/app/auth?tab=register"
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-full border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-blue-400"
        >
          <UserPlus className="h-4 w-4" />
          Register
        </Link>
      </div>
    </aside>
  );
}
