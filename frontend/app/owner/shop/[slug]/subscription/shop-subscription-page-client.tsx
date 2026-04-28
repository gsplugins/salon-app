"use client";

import Link from "next/link";
import { useOwnerShopContext } from "@/components/auth/owner-shop-slug-gate";
import { useShopDashboardProfileState } from "@/components/platform/shop-dashboard-profile-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { canViewShopBilling } from "@/lib/role-access";
import { ownerShopPath } from "@/lib/owner-shop-paths";

export function ShopSubscriptionPageClient() {
  const { slug, me } = useOwnerShopContext();
  const { profile, profileLoading } = useShopDashboardProfileState();
  const show = canViewShopBilling(me) && (profileLoading || profile?.permissions?.can_view_subscription === true);

  if (profileLoading) {
    return <Skeleton className="h-40 w-full max-w-xl rounded-2xl" />;
  }

  if (!show) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        Subscription and billing are visible to the shop owner only. Ask the owner to manage the plan, or open the
        legacy <Link className="font-semibold underline" href={ownerShopPath(slug, "settings")}>Shop preferences</Link> tab.
      </p>
    );
  }

  const sub = profile?.subscription ?? null;
  const meSub = me.subscription;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Current plan</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-800">Plan</dt>
            <dd className="font-medium text-zinc-800 dark:text-white">{sub?.plan_name ?? sub?.plan_key ?? meSub?.plan_key ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-800">Status</dt>
            <dd className="font-medium capitalize">{sub?.status ?? meSub?.status ?? "—"}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-800">Current period ends</dt>
            <dd className="text-right font-mono text-xs text-zinc-800 dark:text-zinc-200">
              {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : meSub?.current_period_end ?? "—"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-zinc-800">Trial ends</dt>
            <dd className="text-right font-mono text-xs text-zinc-800 dark:text-zinc-200">
              {sub?.trial_ends_at ? new Date(sub.trial_ends_at).toLocaleDateString() : meSub?.trial_ends_at ?? "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button type="button" asChild>
            <Link href="/platform">Plan directory</Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href={ownerShopPath(slug, "settings")}>Billing in preferences</Link>
          </Button>
        </div>
      </section>
      {sub?.features && typeof sub.features === "object" ? (
        <section className="rounded-2xl border border-zinc-200/80 bg-white p-5 text-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <h3 className="font-semibold text-zinc-800 dark:text-white">Plan limits</h3>
          <pre className="mt-3 max-h-48 overflow-auto rounded-lg bg-zinc-50 p-3 text-xs dark:bg-zinc-950">
            {JSON.stringify(sub.features, null, 2)}
          </pre>
        </section>
      ) : null}
    </div>
  );
}
