"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ownerShopPath } from "@/lib/owner-shop-paths";

export function ShopPlanUpgradePrompt(props: { shopSlug: string; title: string; description: string }) {
  const { shopSlug, title, description } = props;
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-amber-200/90 bg-amber-50/90 p-6 text-sm text-amber-950 shadow-sm dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-50">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-200" aria-hidden />
        <div>
          <h2 className="text-base font-semibold text-amber-950 dark:text-amber-50">{title}</h2>
          <p className="mt-1 leading-relaxed opacity-95">{description}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={ownerShopPath(shopSlug, "subscription")}
          className="inline-flex min-h-9 items-center rounded-full bg-zinc-900 px-4 py-2 text-xs font-semibold text-white dark:bg-amber-100 dark:text-zinc-800"
        >
          Subscription &amp; plans
        </Link>
        <Link
          href="/platform"
          className="inline-flex min-h-9 items-center rounded-full border border-amber-300/80 bg-white px-4 py-2 text-xs font-semibold text-amber-950 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-100"
        >
          Platform directory
        </Link>
      </div>
    </div>
  );
}
