"use client";

import Link from "next/link";
import { useSalonAccessTokenReady } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";

export function SalonTokenGate(props: {
  children: (accessToken: string) => React.ReactNode;
  roleHint?: string;
}) {
  const { token, ready } = useSalonAccessTokenReady();

  if (!ready) {
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
        <p className="mt-1 opacity-90">
          {props.roleHint ?? "Use the account portal to sign in with JWT access."}
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

  return <>{props.children(token)}</>;
}
