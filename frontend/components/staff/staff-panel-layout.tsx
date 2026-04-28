"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  Calendar,
  Clock,
  Coins,
  LayoutDashboard,
  Scissors,
  Star,
  ToggleLeft,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { availabilityStatusLabel } from "@/lib/staff-ui";
import { fetchStaffNotifications, fetchStaffProfile, type StaffProfilePayload } from "@/lib/staff-api";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { StaffActAsBar } from "@/components/staff/staff-act-as-bar";
import { PortalPanelShell, type PortalNavItem } from "@/components/portal/portal-panel-shell";

const PRIMARY: PortalNavItem[] = [
  { href: "/staff/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/staff/appointments", label: "Bookings", icon: Calendar },
  { href: "/staff/schedule", label: "Schedule", icon: Clock },
  { href: "/staff/earnings", label: "Earnings", icon: Coins },
  { href: "/staff/profile", label: "Profile", icon: User },
];

const SECONDARY: PortalNavItem[] = [
  { href: "/staff/customers", label: "Customers", icon: Users },
  { href: "/staff/services", label: "Services", icon: Scissors },
  { href: "/staff/notifications", label: "Notifications", icon: Bell },
  { href: "/staff/reviews", label: "Reviews", icon: Star },
  { href: "/staff/availability", label: "Availability", icon: ToggleLeft },
];

function statusBadgeClass(status: string): string {
  switch (status) {
    case "available":
      return "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100";
    case "busy":
      return "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100";
    case "on_leave":
      return "border-[color:var(--border)] bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100";
    default:
      return "border-[color:var(--border)] bg-white text-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";
  }
}

export function StaffPanelLayout(props: { accessToken: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const { accessToken } = props;
  const [profile, setProfile] = useState<StaffProfilePayload | null>(null);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const [p, n] = await Promise.all([fetchStaffProfile(accessToken), fetchStaffNotifications(accessToken)]);
    if (p.ok) setProfile(p.data);
    else setProfile(null);
    if (n.ok) setUnread(n.data.filter((x) => !x.is_read).length);
    else setUnread(0);
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load, pathname]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 90_000);
    return () => window.clearInterval(id);
  }, [load]);

  const shopName = profile?.shop?.name ?? "Your salon";
  const shopInactive = profile?.shop?.is_active === false;
  const st = profile?.availability_status ?? "available";

  const header =
    profile != null
      ? ({
          state: "ready" as const,
          avatarUrl: profile.photo_url,
          avatarFallback: profile.name.slice(0, 1).toUpperCase(),
          title: profile.name,
          subtitle: shopName,
          badge: (
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide",
                statusBadgeClass(st)
              )}
            >
              {availabilityStatusLabel(st)}
            </span>
          ),
        } as const)
      : ({ state: "loading" } as const);

  return (
    <PortalPanelShell
      brandLabel="Staff"
      brandHref="/staff/dashboard"
      sidebarContextLine={shopName}
      primaryNav={shopInactive ? [] : PRIMARY}
      secondaryNav={shopInactive ? [] : SECONDARY}
      header={header}
      headerTrailing={
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex">
            <AuthHeaderProfile />
          </span>
          {!shopInactive ? (
            <Link
              href="/staff/notifications"
              className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-[color:var(--border)] bg-white text-zinc-700 shadow-sm dark:bg-zinc-900 dark:text-zinc-200"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unread > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white">
                  {unread > 99 ? "99+" : unread}
                </span>
              ) : null}
            </Link>
          ) : null}
        </div>
      }
      footerLink={{ href: "/app", label: "Account portal" }}
    >
      {!shopInactive ? <StaffActAsBar accessToken={accessToken} onStaffContextChange={() => void load()} /> : null}
      <div className="mb-4 flex justify-end sm:hidden">
        <div className="flex items-center gap-2 rounded-2xl border border-[color:var(--border)] bg-white px-3 py-2 dark:bg-zinc-900/50">
          <AuthHeaderProfile />
        </div>
      </div>
      {shopInactive ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          <p className="font-semibold">Shop subscription inactive</p>
          <p className="mt-1">
            Your shop is currently inactive. Ask the shop owner/manager to upgrade or renew the plan to continue using staff tools.
          </p>
        </div>
      ) : (
        props.children
      )}
    </PortalPanelShell>
  );
}
