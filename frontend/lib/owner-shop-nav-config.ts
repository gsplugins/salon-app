import type { LucideIcon } from "lucide-react";
import {
  ExternalLink,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  Map,
  MessageSquare,
  Package,
  Scissors,
  Settings2,
  Store,
  UserRound,
  Users,
} from "lucide-react";
import { ownerShopPath } from "@/lib/owner-shop-paths";

export type OwnerNavEntry = {
  href: string;
  label: string;
  icon: LucideIcon;
  hint?: string;
};

export type OwnerNavGroup = { id: string; title: string; items: OwnerNavEntry[] };

/** Same sections as the shop owner sidebar (`OwnerShopSidebarShell`). */
export function buildOwnerShopNavGroups(shopSlug: string): OwnerNavGroup[] {
  const o = (segment?: string) => ownerShopPath(shopSlug, segment);
  const base = o();

  return [
    {
      id: "main",
      title: "Home",
      items: [
        {
          href: base,
          label: "Overview & hub",
          icon: LayoutDashboard,
          hint: "Stats and analytics for your shop",
        },
      ],
    },
    {
      id: "settings",
      title: "Settings",
      items: [
        {
          href: o("account"),
          label: "Account",
          icon: UserRound,
          hint: "Your profile, roles, and platform access",
        },
        {
          href: o("settings"),
          label: "Shop preferences",
          icon: Settings2,
          hint: "Hours, contact, alerts, policies, and billing",
        },
      ],
    },
    {
      id: "catalog",
      title: "Menu & team",
      items: [
        { href: o("services"), label: "Services & pricing", icon: Scissors, hint: "Catalog, duration, prices" },
        { href: o("staff"), label: "Staff & roles", icon: Users, hint: "Team and stylist access" },
        { href: o("shops"), label: "Branches", icon: Store, hint: "Other locations" },
      ],
    },
    {
      id: "ops",
      title: "Day-to-day",
      items: [
        { href: o("queue"), label: "Walk-in queue", icon: ListOrdered, hint: "Live queue" },
        { href: o("reviews"), label: "Reviews", icon: MessageSquare, hint: "Replies and ratings" },
      ],
    },
    {
      id: "insights",
      title: "Insights & stock",
      items: [
        { href: o("reports"), label: "Reports", icon: LineChart, hint: "Performance" },
        { href: o("inventory"), label: "Inventory", icon: Package, hint: "Products & stock" },
      ],
    },
  ];
}

export function ownerShopBookingPublicHref(shopSlug: string): string {
  return `/s/${encodeURIComponent(shopSlug)}/book`;
}

/** Icons exported for shop card / compact menus that need the booking CTA icon. */
export const ownerNavIcons = { ExternalLink, Map };

export function isOwnerShopNavActive(pathname: string, href: string, base: string): boolean {
  if (href === base) return pathname === base || pathname === `${base}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}
