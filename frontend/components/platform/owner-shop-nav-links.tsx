"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useOwnerShopContext } from "@/components/auth/owner-shop-slug-gate";
import { useShopDashboardProfileState } from "@/components/platform/shop-dashboard-profile-context";
import type { AuthMePayload } from "@/lib/auth-api";
import type { ShopProfile } from "@/lib/salon-api";
import {
  buildOwnerShopNavGroups,
  isOwnerShopNavActive,
  ownerNavIcons,
} from "@/lib/owner-shop-nav-config";
import { ownerShopPath } from "@/lib/owner-shop-paths";

const { Map } = ownerNavIcons;

export function OwnerShopNavLinksInner(props: {
  shopSlug: string;
  variant?: "aside" | "embedded";
  me: AuthMePayload;
  profile: ShopProfile | null;
  profileLoading: boolean;
}) {
  const { shopSlug, variant = "aside", me, profile, profileLoading } = props;
  const pathname = usePathname();
  const base = ownerShopPath(shopSlug);
  const groups = buildOwnerShopNavGroups({ shopSlug, me, profile, profileLoading });
  const navTop = variant === "embedded" ? "mt-0" : "mt-5";

  return (
    <>
      <nav className={`${navTop} space-y-5`} aria-label="Shop owner navigation">
        {groups.map((group) => (
          <div key={group.id}>
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-800">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isOwnerShopNavActive(pathname, item.href, base);
                const key = `${group.id}-${item.href}-${item.label}`;
                return (
                  <li key={key}>
                    <Link
                      href={item.href}
                      title={item.hint}
                      className={`flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition touch-manipulation active:scale-[0.99] ${
                        active
                          ? "bg-zinc-900 text-white shadow-md dark:bg-rose-100 dark:text-zinc-800"
                          : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-85" aria-hidden />
                      <span className="min-w-0 leading-snug">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <p
        className={`rounded-lg bg-zinc-100/80 px-2.5 py-2 text-[11px] leading-snug text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400 ${variant === "embedded" ? "mt-3" : "mt-4"}`}
      >
        <span className="font-medium text-zinc-700 dark:text-zinc-300">Account</span> is for your profile;{" "}
        <span className="font-medium text-zinc-700 dark:text-zinc-300">Shop preferences</span> covers hours, alerts, and
        policies.
      </p>

      <div
        className={`border-t border-zinc-200 pt-4 dark:border-zinc-700 ${variant === "embedded" ? "mt-4" : "mt-5"}`}
      >
        <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-800">
          More
        </p>
        <ul className="mt-2 space-y-0.5">
          <li>
            <Link
              href="/platform"
              className="flex min-h-9 items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-rose-800 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-950/30"
            >
              <Map className="h-3.5 w-3.5 opacity-70" aria-hidden />
              Site map
            </Link>
          </li>
          <li>
            <Link
              href="/"
              className="flex min-h-9 items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Marketing home
            </Link>
          </li>
        </ul>
      </div>
    </>
  );
}

export function OwnerShopNavLinks(props: { shopSlug: string; variant?: "aside" | "embedded" }) {
  const { shopSlug, variant = "aside" } = props;
  const { me } = useOwnerShopContext();
  const { profile, profileLoading } = useShopDashboardProfileState();
  return (
    <OwnerShopNavLinksInner
      shopSlug={shopSlug}
      variant={variant}
      me={me}
      profile={profile}
      profileLoading={profileLoading}
    />
  );
}
