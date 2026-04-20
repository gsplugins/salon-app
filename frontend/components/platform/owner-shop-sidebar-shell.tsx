"use client";

import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { OwnerShopAdminShopCard } from "@/components/platform/owner-shop-admin-shop-card";
import { OwnerShopNavLinks } from "@/components/platform/owner-shop-nav-links";

export function OwnerShopSidebarShell(props: { shopSlug: string; shopName: string; children: React.ReactNode }) {
  const { shopSlug, shopName, children } = props;

  return (
    <div className="min-h-[100dvh] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:py-8 lg:gap-10">
        <aside className="w-full shrink-0 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:w-64 md:self-start md:overflow-y-auto">
          <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-800 dark:text-rose-200">
              Admin panel
            </p>
            <div className="mt-3">
              <OwnerShopAdminShopCard shopName={shopName} shopSlug={shopSlug} />
            </div>

            <OwnerShopNavLinks shopSlug={shopSlug} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 md:px-6">
            <p className="hidden text-xs text-zinc-500 sm:block">
              Signed-in tools for <span className="font-medium text-zinc-700 dark:text-zinc-300">{shopName}</span>
            </p>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
              <AuthHeaderProfile variant="compact" />
              <div className="hidden md:block">
                <ThemeToggle />
              </div>
            </div>
          </div>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
