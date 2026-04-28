"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Bell, Calendar, Clock3, Compass, CreditCard, Gift, Heart, Home, Star, Store, User } from "lucide-react";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { SALON_AUTH_CHANGE_EVENT } from "@/lib/auth-events";
import { fetchCustomerLoyalty, fetchCustomerNotifications } from "@/lib/salon-api";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
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
  { href: "/customer/waitlist", label: "Waitlist", icon: Clock3 },
  { href: "/customer/favorites", label: "Favorites", icon: Heart },
  { href: "/customer/payments", label: "Payments", icon: CreditCard },
  { href: "/customer/reviews", label: "Reviews", icon: Star },
];

export function CustomerPanelLayout(props: { accessToken: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { accessToken } = props;
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [points, setPoints] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const [m, l, n] = await Promise.all([
      fetchAuthMe(accessToken),
      fetchCustomerLoyalty(accessToken),
      fetchCustomerNotifications(accessToken),
    ]);
    if (m.ok) setMe(m.data);
    else setMe(null);
    if (l.ok) setPoints(l.data.points);
    else setPoints(null);
    if (n.ok) setUnread(n.data.filter((x) => !x.is_read).length);
    else setUnread(0);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const onAuthChanged = () => void load();
    window.addEventListener(SALON_AUTH_CHANGE_EVENT, onAuthChanged);
    window.addEventListener("focus", onAuthChanged);
    return () => {
      window.removeEventListener(SALON_AUTH_CHANGE_EVENT, onAuthChanged);
      window.removeEventListener("focus", onAuthChanged);
    };
  }, [load]);

  const header =
    me != null
      ? ({
          state: "ready" as const,
          avatarUrl: me.photo_url ?? null,
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
            <AuthHeaderProfile />
          </span>
          <Link
            href="/customer/notifications"
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[color:var(--border)] bg-white text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200"
            aria-label="Customer notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          <Link
            href="/shops"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[color:var(--border)] bg-white text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200"
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
        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 dark:bg-zinc-900/50">
          <Link
            href="/customer/notifications"
            className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[color:var(--border)] bg-white text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200"
            aria-label="Customer notifications"
          >
            <Bell className="h-5 w-5" />
            {unread > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Link>
          <AuthHeaderProfile />
        </div>
      </div>
      {props.children}
    </PortalPanelShell>
  );
}
