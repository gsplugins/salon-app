"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { Bell } from "lucide-react";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
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
          avatarUrl: me?.photo_url ?? null,
          avatarFallback: (me?.name ?? "A").slice(0, 1).toUpperCase(),
          title: me?.name ?? "Administrator",
          subtitle: "Platform admin",
        } as const);

  return (
    <div className="admin-theme-scope">
      <PortalPanelShell
        brandLabel="Admin"
        brandHref="/admin/dashboard"
        sidebarContextLine="Platform"
        primaryNav={PRIMARY}
        secondaryNav={SECONDARY}
        header={header}
        headerTrailing={
          <div className="hidden items-center gap-2 sm:flex">
            <Link
              href="/admin/notifications"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              aria-label="Admin notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>
            <AuthHeaderProfile />
          </div>
        }
        footerLink={{ href: "/platform", label: "Site map" }}
        footerLink2={{ href: "/", label: "Marketing home" }}
      >
        <div className="mb-4 flex justify-end sm:hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-zinc-200 bg-white px-3 py-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
            <Link
              href="/admin/notifications"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
              aria-label="Admin notifications"
            >
              <Bell className="h-5 w-5" />
            </Link>
            <AuthHeaderProfile />
          </div>
        </div>
        {children}
      </PortalPanelShell>
    </div>
  );
}
