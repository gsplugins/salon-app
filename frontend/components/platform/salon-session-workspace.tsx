"use client";

import { Building2, UserRound } from "lucide-react";
import { useId, useState } from "react";

export type SalonSessionTab = "profile" | "shop";

/**
 * Split **Profile** vs **Shop** for signed-in salon staff / owners on `/app`.
 * Matches the owner dashboard shell (zinc/rose, cards) and uses patterns that map cleanly to a future mobile tab navigator (large touch targets, single active surface).
 */
export function SalonSessionWorkspace(props: {
  /** Shown above the tab control for context (e.g. shop name). */
  shopLabel: string;
  childrenProfile: React.ReactNode;
  childrenShop: React.ReactNode;
  /** Optional: default tab (e.g. deep link later). */
  defaultTab?: SalonSessionTab;
}) {
  const { shopLabel, childrenProfile, childrenShop, defaultTab = "profile" } = props;
  const [tab, setTab] = useState<SalonSessionTab>(defaultTab);
  const baseId = useId();

  return (
    <div className="flex min-h-[min(100dvh,920px)] flex-col">
      <div className="sticky top-0 z-20 border-b border-zinc-200/90 bg-zinc-50/95 px-3 py-3 pt-safe backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 sm:px-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-800 dark:text-rose-200">
              Account
            </p>
            <p className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-100">{shopLabel}</p>
          </div>
          <div
            className="flex w-full rounded-2xl border border-zinc-200 bg-white p-1 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:max-w-md"
            role="tablist"
            aria-label="Profile or shop management"
          >
            <button
              type="button"
              role="tab"
              id={`${baseId}-profile`}
              aria-selected={tab === "profile"}
              aria-controls={`${baseId}-profile-panel`}
              onClick={() => setTab("profile")}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.99] touch-manipulation ${
                tab === "profile"
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-rose-100 dark:text-zinc-800"
                  : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              }`}
            >
              <UserRound className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Profile
            </button>
            <button
              type="button"
              role="tab"
              id={`${baseId}-shop`}
              aria-selected={tab === "shop"}
              aria-controls={`${baseId}-shop-panel`}
              onClick={() => setTab("shop")}
              className={`flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition active:scale-[0.99] touch-manipulation ${
                tab === "shop"
                  ? "bg-zinc-900 text-white shadow-sm dark:bg-rose-100 dark:text-zinc-800"
                  : "text-zinc-800 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
              }`}
            >
              <Building2 className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              Shop
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 flex-1 px-3 pb-safe sm:px-5">
        <div
          id={`${baseId}-profile-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-profile`}
          hidden={tab !== "profile"}
          className={tab === "profile" ? "block" : "hidden"}
        >
          {childrenProfile}
        </div>
        <div
          id={`${baseId}-shop-panel`}
          role="tabpanel"
          aria-labelledby={`${baseId}-shop`}
          hidden={tab !== "shop"}
          className={tab === "shop" ? "block" : "hidden"}
        >
          {childrenShop}
        </div>
      </div>
    </div>
  );
}
