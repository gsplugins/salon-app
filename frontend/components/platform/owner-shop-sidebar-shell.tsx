"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalPanelShell, type PortalNavItem } from "@/components/portal/portal-panel-shell";
import type { AuthMePayload } from "@/lib/auth-api";
import type { ShopProfile } from "@/lib/salon-api";
import { buildOwnerShopNavGroups } from "@/lib/owner-shop-nav-config";

export function OwnerShopSidebarShell(props: {
  shopSlug: string;
  shopName: string;
  me: AuthMePayload;
  actingAsSuperAdmin?: boolean;
  shopProfile?: ShopProfile | null;
  profileLoading?: boolean;
  children: React.ReactNode;
}) {
  const { shopSlug, shopName, me, actingAsSuperAdmin, shopProfile, profileLoading, children } = props;
  const groups = buildOwnerShopNavGroups({
    shopSlug,
    me,
    profile: shopProfile ?? null,
    profileLoading: profileLoading ?? false,
  });
  const navAll: PortalNavItem[] = groups.flatMap((g) => g.items).map((i) => ({
    href: i.href,
    label: i.label,
    icon: i.icon,
    exact: i.href === `/owner/shop/${encodeURIComponent(shopSlug)}`,
  }));
  const primaryNav = navAll.slice(0, 5);
  const secondaryNav = navAll.slice(5);
  const planLabel = shopProfile?.subscription?.plan_name?.trim() || shopProfile?.subscription?.plan_key || null;

  return (
    <PortalPanelShell
      brandLabel="Manager"
      brandHref={`/owner/shop/${encodeURIComponent(shopSlug)}`}
      sidebarContextLine={shopName}
      primaryNav={primaryNav}
      secondaryNav={secondaryNav}
      header={{
        state: "ready",
        avatarFallback: shopName.slice(0, 1).toUpperCase(),
        title: shopName,
        subtitle: "Shop manager",
        badge: planLabel ? (
          <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">
            {planLabel}
          </span>
        ) : undefined,
      }}
      headerTrailing={
        <div className="hidden items-center gap-2 sm:flex">
          <ThemeToggle />
          <AuthHeaderProfile variant="compact" />
        </div>
      }
      footerLink={{ href: "/platform", label: "Site map" }}
      footerLink2={{ href: "/", label: "Marketing home" }}
    >
      <div className="mb-4 flex justify-end sm:hidden">
        <div className="flex items-center gap-2 rounded-2xl border border-zinc-200/80 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/50">
          <ThemeToggle />
          <AuthHeaderProfile variant="compact" />
        </div>
      </div>
      {actingAsSuperAdmin ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/25 dark:text-amber-50">
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1 font-medium">
            Platform super admin: full access to this salon (same tools as the shop manager).
          </p>
          <Link
            href="/admin/shops"
            className="shrink-0 rounded-full border border-amber-300/80 bg-white px-3 py-1 text-xs font-semibold text-amber-950 shadow-sm hover:bg-amber-100 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-100 dark:hover:bg-zinc-800"
          >
            Admin directory
          </Link>
        </div>
      ) : null}
      {children}
    </PortalPanelShell>
  );
}

/** Alias for product docs: all shop manager routes use this shell (sidebar + main). */
export const ShopDashboardLayout = OwnerShopSidebarShell;
