"use client";

import Link from "next/link";
import {
  Building2,
  Calendar,
  Crown,
  LayoutDashboard,
  Scissors,
  Shield,
  Sparkles,
  Store,
  UserCircle,
} from "lucide-react";
import type { AuthMePayload } from "@/lib/auth-api";
import {
  canAccessSalonManagement,
  canAccessSuperAdmin,
  canViewShopBilling,
} from "@/lib/role-access";
import { getPrimaryDashboardPath, getRoleLabel } from "@/lib/auth-session";
import { ownerShopBase } from "@/lib/owner-shop-paths";

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.charAt(0).toUpperCase();
}

export type SessionAccountTab = "profile" | "workspace" | "platform";

export function RoleProfilePanel({
  me,
  variant = "default",
  sessionAccountTab,
}: {
  me: AuthMePayload;
  /** `session`: paired with Shop tab on `/app` — shorter workspace copy, larger touch targets. */
  variant?: "default" | "session";
  /** When set with `variant="session"`, only that slice renders (nested Account sub-tabs). */
  sessionAccountTab?: SessionAccountTab;
}) {
  const label = getRoleLabel(me);
  const dash = getPrimaryDashboardPath(me);
  const shopRole = me.shop_access?.role ?? null;
  const salonTeam = canAccessSalonManagement(me);
  const tab = sessionAccountTab;
  const showProfile = !tab || tab === "profile";
  const showWorkspace = !tab || tab === "workspace";
  const showPlatform = !tab || tab === "platform";

  return (
    <div className="space-y-4">
      {showProfile ? (
      <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200 bg-gradient-to-br from-white to-zinc-50/80 p-5 dark:border-zinc-700 dark:from-zinc-900/80 dark:to-zinc-950/80 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 text-2xl font-bold text-white shadow-md">
            {initials(me.name)}
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-rose-800/90 dark:text-rose-200/90">
              Signed in as
            </p>
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">{me.name}</h3>
            <p className="font-mono text-sm text-zinc-500">{me.mobile}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-semibold text-rose-950 dark:bg-rose-950/50 dark:text-rose-100">
                <UserCircle className="h-3.5 w-3.5" aria-hidden />
                {label}
              </span>
              {me.global_role ? (
                <span className="rounded-full bg-zinc-200/80 px-2.5 py-0.5 text-[11px] font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                  Platform: {me.global_role}
                </span>
              ) : null}
              {shopRole ? (
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-medium text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-100">
                  Shop role: {shopRole.replace("_", " ")}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        <Link
          href={dash}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 active:scale-[0.99] dark:bg-rose-100 dark:text-zinc-900 dark:hover:bg-white touch-manipulation"
        >
          <LayoutDashboard className="h-4 w-4" aria-hidden />
          Open my dashboard
        </Link>
      </div>
      ) : null}

      {showProfile && me.role === "customer" ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900/40">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <Sparkles className="h-4 w-4 text-rose-600 dark:text-rose-300" aria-hidden />
            Customer profile
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Book appointments, track visits, and use loyalty points. Your data stays tied to your mobile number.
          </p>
          <ul className="mt-3 space-y-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            <li className="flex items-center gap-2">
              <span className="text-rose-600 dark:text-rose-300">✓</span> Loyalty points:{" "}
              <strong className="text-zinc-900 dark:text-white">{me.loyalty_points ?? 0}</strong>
            </li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Calendar className="h-4 w-4" aria-hidden />
              Appointments &amp; loyalty
            </Link>
            <Link
              href="/shops"
              className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Store className="h-4 w-4" aria-hidden />
              Browse shops
            </Link>
          </div>
        </div>
      ) : null}

      {showWorkspace && salonTeam && me.shop ? (
        <div
          className={`rounded-2xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900/40 ${
            variant === "session" ? "p-4" : "p-5"
          }`}
        >
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
            <Building2 className="h-4 w-4 text-rose-600 dark:text-rose-300" aria-hidden />
            {variant === "session" ? "Shop access" : "Salon workspace"}
          </div>
          {variant === "session" ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Use the primary <strong className="text-zinc-900 dark:text-white">Shop</strong> tab above for
              bookings, services, team, and shop settings.
            </p>
          ) : (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {me.is_manager || me.role === "manager"
                ? "You have operational access: bookings, services, inventory, and reports. Billing and subscription are visible to the shop owner only."
                : me.is_shop_owner || me.role === "shop_owner"
                  ? "You own this business — full settings, billing, and team tools."
                  : me.role === "barber"
                    ? "Stylist account — your schedule and day-to-day visits."
                    : "Shop tools for your location."}
            </p>
          )}
          <div className="mt-3 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-zinc-800/50">
            <span className="text-zinc-500">Active shop:</span>{" "}
            <strong className="text-zinc-900 dark:text-white">{me.shop.name}</strong>
            <span className="ml-2 font-mono text-xs text-zinc-500">/{me.shop.slug}</span>
          </div>
          {canViewShopBilling(me) && me.subscription ? (
            <div className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              <span className="font-medium text-zinc-800 dark:text-zinc-200">Subscription:</span>{" "}
              {me.subscription.plan_key} ({me.subscription.status})
            </div>
          ) : salonTeam && !canViewShopBilling(me) ? (
            <p className="mt-3 text-xs text-amber-800 dark:text-amber-200/90">
              Subscription and billing details are restricted to the shop owner.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={me.shop?.slug ? ownerShopBase(me.shop.slug) : "/owner/dashboard"}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white active:scale-[0.99] dark:bg-rose-100 dark:text-zinc-900 touch-manipulation"
            >
              <LayoutDashboard className="h-4 w-4" aria-hidden />
              Owner / ops dashboard
            </Link>
            <Link
              href={`/s/${me.shop.slug}/book`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 active:scale-[0.99] dark:border-zinc-600 dark:text-zinc-200 touch-manipulation"
            >
              Public booking page
            </Link>
            {me.role === "barber" ? (
              <Link
                href="/barber/schedule"
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-medium text-zinc-800 active:scale-[0.99] dark:border-zinc-600 dark:text-zinc-200 touch-manipulation"
              >
                <Scissors className="h-4 w-4" aria-hidden />
                My schedule
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {showPlatform && canAccessSuperAdmin(me) ? (
        <div className="rounded-2xl border border-violet-200 bg-violet-50/80 p-5 dark:border-violet-900/60 dark:bg-violet-950/30">
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-950 dark:text-violet-100">
            <Shield className="h-4 w-4" aria-hidden />
            Platform administrator
          </div>
          <p className="mt-2 text-sm text-violet-900/90 dark:text-violet-200/90">
            Manage all shops, users, subscriptions, and payments across the platform.
          </p>
          <Link
            href="/admin/dashboard"
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-violet-900 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-800 dark:bg-violet-300 dark:text-violet-950"
          >
            <Crown className="h-4 w-4" aria-hidden />
            Admin dashboard
          </Link>
        </div>
      ) : null}
    </div>
  );
}
