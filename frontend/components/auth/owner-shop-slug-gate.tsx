"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { canAccessSalonManagement } from "@/lib/role-access";
import { useSalonAccessTokenReady } from "@/hooks/use-salon-access-token";
import { ownerShopBase } from "@/lib/owner-shop-paths";
import { Skeleton } from "@/components/ui/skeleton";

type OwnerShopContextValue = {
  slug: string;
  shopName: string;
  me: AuthMePayload;
};

const OwnerShopContext = createContext<OwnerShopContextValue | null>(null);

export function useOwnerShopContext(): OwnerShopContextValue {
  const v = useContext(OwnerShopContext);
  if (!v) {
    throw new Error("useOwnerShopContext must be used under OwnerShopSlugGate");
  }
  return v;
}

export function OwnerShopSlugGate(props: { slug: string; children: React.ReactNode }) {
  const { slug, children } = props;
  const { token, ready } = useSalonAccessTokenReady();

  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "no_token" }
    | { kind: "forbidden"; me: AuthMePayload | null }
    | { kind: "wrong_slug"; me: AuthMePayload; expectedSlug: string }
    | { kind: "ok"; me: AuthMePayload }
  >({ kind: "loading" });

  const load = useCallback(async () => {
    if (!ready) return;
    if (!token) {
      setState({ kind: "no_token" });
      return;
    }
    const res = await fetchAuthMe(token);
    if (!res.ok) {
      setState({ kind: "forbidden", me: null });
      return;
    }
    const me = res.data;
    if (!canAccessSalonManagement(me)) {
      setState({ kind: "forbidden", me });
      return;
    }
    const expected = me.shop?.slug ?? "";
    if (!expected) {
      setState({ kind: "forbidden", me });
      return;
    }
    if (expected !== slug) {
      setState({ kind: "wrong_slug", me, expectedSlug: expected });
      return;
    }
    setState({ kind: "ok", me });
  }, [token, slug, ready]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load /auth/me for slug RBAC
    void load();
  }, [load]);

  if (!ready || state.kind === "loading") {
    return (
      <div className="space-y-3 p-4 md:p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (state.kind === "no_token" || state.kind === "forbidden") {
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-medium">Sign in required</p>
          <p className="mt-1 opacity-90">Shop owner routes need a salon staff or owner session.</p>
          <Link
            href="/app"
            className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
          >
            Sign in at /app
          </Link>
        </div>
      </div>
    );
  }

  if (state.kind === "wrong_slug") {
    const href = ownerShopBase(state.expectedSlug);
    return (
      <div className="p-4 md:p-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900/50">
          <p className="font-medium text-zinc-900 dark:text-white">Different active shop</p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This URL is for <span className="font-mono">{slug}</span>, but your session is for{" "}
            <span className="font-mono">{state.expectedSlug}</span>.
          </p>
          <Link
            href={href}
            className="mt-4 inline-flex rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
          >
            Open {state.me.shop?.name ?? state.expectedSlug}
          </Link>
        </div>
      </div>
    );
  }

  const shopName = state.me.shop?.name?.trim() || slug;

  return (
    <OwnerShopContext.Provider value={{ slug, shopName, me: state.me }}>{children}</OwnerShopContext.Provider>
  );
}
