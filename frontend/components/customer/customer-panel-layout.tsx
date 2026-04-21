"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, Calendar, Compass, CreditCard, Gift, Heart, Home, Star, Store, User } from "lucide-react";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { fetchCustomerLoyalty } from "@/lib/salon-api";
import { ThemeToggle } from "@/components/theme-toggle";
import { PortalPanelShell, type PortalNavItem } from "@/components/portal/portal-panel-shell";

const PRIMARY: PortalNavItem[] = [
  { href: "/customer/home", label: "Home", icon: Home },
  { href: "/customer/explore", label: "Explore", icon: Compass },
  { href: "/customer/appointments", label: "Appointments", icon: Calendar },
  { href: "/customer/loyalty", label: "Loyalty", icon: Gift },
  { href: "/customer/profile", label: "Profile", icon: User },
];

const SECONDARY: PortalNavItem[] = [
  { href: "/customer/notifications", label: "Notifications", icon: Bell },
  { href: "/customer/favorites", label: "Favorites", icon: Heart },
  { href: "/customer/payments", label: "Payments", icon: CreditCard },
  { href: "/customer/reviews", label: "Reviews", icon: Star },
];

export function CustomerPanelLayout(props: { accessToken: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { accessToken } = props;
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [points, setPoints] = useState<number | null>(null);

  const load = useCallback(async () => {
    const m = await fetchAuthMe(accessToken);
    if (m.ok) setMe(m.data);
    else setMe(null);
    const l = await fetchCustomerLoyalty(accessToken);
    if (l.ok) setPoints(l.data.points);
    else setPoints(null);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  const header =
    me != null
      ? ({
          state: "ready" as const,
          avatarFallback: me.name.slice(0, 1).toUpperCase(),
          title: me.name,
          subtitle: "Customer",
          badge:
            points != null ? (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-rose-900 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-100">
                {points} pts
              </span>
            ) : undefined,
        } as const)
      : ({ state: "loading" } as const);

  return (
    <PortalPanelShell
      brandLabel="Customer"
      brandHref="/customer/home"
      sidebarContextLine="My salon"
      primaryNav={PRIMARY}
      secondaryNav={SECONDARY}
      header={header}
      headerTrailing={
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <ThemeToggle />
          </span>
          <Link
            href="/shops"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
            aria-label="Browse shops"
          >
            <Store className="h-5 w-5" />
          </Link>
        </div>
      }
      footerLink={{ href: "/app", label: "Account portal" }}
      footerLink2={{ href: "/", label: "Marketing home" }}
    >
      <div className="mb-4 flex justify-end sm:hidden">
        <ThemeToggle />
      </div>
      {props.children}
    </PortalPanelShell>
  );
}
