"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalPanelShell, type PortalNavItem } from "@/components/portal/portal-panel-shell";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { setSalonActAsShopSlug } from "@/lib/salon-act-as-shop";
import { useSalonAccessTokenReady } from "@/hooks/use-salon-access-token";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";

const PRIMARY: PortalNavItem[] = ADMIN_NAV.slice(0, 5);
const SECONDARY: PortalNavItem[] = ADMIN_NAV.slice(5);

export function AdminSettingsShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { token, ready } = useSalonAccessTokenReady();
  const [me, setMe] = useState<AuthMePayload | null | undefined>(undefined);

  useLayoutEffect(() => {
    setSalonActAsShopSlug(null);
  }, []);

  const loadMe = useCallback(async () => {
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
    if (!ready) return;
    void loadMe();
  }, [ready, loadMe, pathname]);

  const header =
    !ready || me === undefined
      ? ({ state: "loading" } as const)
      : ({
          state: "ready" as const,
          avatarFallback: (me?.name ?? "A").slice(0, 1).toUpperCase(),
          title: me?.name ?? "Administrator",
          subtitle: "Platform admin",
        } as const);

  return (
    <PortalPanelShell
      brandLabel="Admin"
      brandHref="/admin/dashboard"
      sidebarContextLine="Platform"
      primaryNav={PRIMARY}
      secondaryNav={SECONDARY}
      header={header}
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
      {children}
    </PortalPanelShell>
  );
}
