import type { AuthMePayload } from "@/lib/auth-api";
import type { ShopProfile } from "@/lib/salon-api";
import { canViewShopBilling } from "@/lib/role-access";
import { isSegmentAllowedForProfile, planTierLabel, requiredPlanForSegment } from "@/lib/shop-plan-access";
import { shopPlanHasLoyalty, shopPlanHasMultiBranch } from "@/lib/shop-plan-features";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  ExternalLink,
  Gift,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  Map,
  MessageSquare,
  Package,
  Scissors,
  Settings2,
  Sparkles,
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
  disabled?: boolean;
  disabledHint?: string;
};

export type OwnerNavGroup = { id: string; title: string; items: OwnerNavEntry[] };

export type OwnerShopNavBuildInput = {
  shopSlug: string;
  me: AuthMePayload;
  profile: ShopProfile | null;
  profileLoading: boolean;
};

export function buildOwnerShopNavGroups(input: OwnerShopNavBuildInput): OwnerNavGroup[] {
  const { shopSlug, me, profile, profileLoading } = input;
  const o = (segment?: string) => ownerShopPath(shopSlug, segment);
  const base = o();

  const isBarber = me.role === "barber";
  const showSubscription =
    canViewShopBilling(me) &&
    (profileLoading || profile === null || profile.permissions?.can_view_subscription === true);

  if (isBarber) {
    return [
      {
        id: "main",
        title: "Home",
        items: [
          {
            href: base,
            label: "Overview",
            icon: LayoutDashboard,
            hint: "Quick stats for your shop",
          },
        ],
      },
      {
        id: "schedule",
        title: "Schedule",
        items: [
          {
            href: o("appointments"),
            label: "My appointments",
            icon: CalendarDays,
            hint: "Bookings assigned to you",
          },
          { href: o("queue"), label: "Walk-in queue", icon: ListOrdered, hint: "Live queue" },
        ],
      },
      {
        id: "self",
        title: "Account",
        items: [{ href: o("account"), label: "Profile & access", icon: UserRound, hint: "Your login and roles" }],
      },
    ];
  }

  const showLoyalty = !profileLoading && profile !== null && shopPlanHasLoyalty(profile);
  const showMultiBranchNav = !profileLoading && profile !== null && shopPlanHasMultiBranch(profile);

  const withPlanState = (entry: OwnerNavEntry): OwnerNavEntry => {
    if (profileLoading || profile === null) return entry;
    const seg = entry.href.split("/").pop() ?? "";
    const required = requiredPlanForSegment(seg);
    if (isSegmentAllowedForProfile(profile, seg)) return entry;
    return {
      ...entry,
      disabled: true,
      disabledHint: `Upgrade to ${planTierLabel(required)} plan to unlock ${entry.label}.`,
    };
  };

  return [
    {
      id: "main",
      title: "Home",
      items: [
        {
          href: base,
          label: "Overview & hub",
          icon: LayoutDashboard,
          hint: "Stats and shortcuts",
        },
        {
          href: o("general"),
          label: "General",
          icon: Sparkles,
          hint: "Name, media, hours, holidays, about",
        },
      ],
    },
    {
      id: "catalog",
      title: "Menu & team",
      items: [
        withPlanState({ href: o("services"), label: "Services", icon: Scissors, hint: "Catalog, duration, prices" }),
        withPlanState({ href: o("staff"), label: "Staff", icon: Users, hint: "Team, roles, services" }),
        ...(showMultiBranchNav
          ? [withPlanState({ href: o("branches"), label: "Branches", icon: Store, hint: "Other locations" } as const)]
          : []),
      ],
    },
    {
      id: "ops",
      title: "Operations",
      items: [
        withPlanState({ href: o("appointments"), label: "Appointments", icon: CalendarDays, hint: "Calendar and list" }),
        withPlanState({ href: o("customers"), label: "Customers", icon: UserRound, hint: "Directory and visits" }),
        withPlanState({ href: o("payments"), label: "Payments", icon: CreditCard, hint: "Transactions and refunds" }),
        { href: o("queue"), label: "Walk-in queue", icon: ListOrdered, hint: "Live queue" },
        { href: o("reviews"), label: "Reviews", icon: MessageSquare, hint: "Ratings and replies" },
      ],
    },
    {
      id: "booking",
      title: "Booking & comms",
      items: [
        { href: o("booking"), label: "Booking rules", icon: CalendarDays, hint: "Windows, buffers, policies" },
        {
          href: o("notifications"),
          label: "Notifications",
          icon: Bell,
          hint: "Reminders and message templates",
        },
      ],
    },
    {
      id: "insights",
      title: "Insights",
      items: [
        withPlanState({ href: o("analytics"), label: "Analytics", icon: LineChart, hint: "Revenue and performance" }),
        withPlanState({ href: o("reports"), label: "Reports", icon: BarChart3, hint: "Legacy reports" }),
        withPlanState({ href: o("inventory"), label: "Inventory", icon: Package, hint: "Products & stock" }),
      ],
    },
    {
      id: "settings",
      title: "Settings",
      items: [
        { href: o("account"), label: "Account", icon: UserRound, hint: "Your profile and roles" },
        { href: o("settings"), label: "Shop preferences", icon: Settings2, hint: "Legacy hub (hours, billing)" },
        ...(showLoyalty
          ? [withPlanState({ href: o("loyalty"), label: "Loyalty", icon: Gift, hint: "Points rules and balances" } as const)]
          : []),
        ...(showSubscription
          ? [{ href: o("subscription"), label: "Subscription", icon: CreditCard, hint: "Plan and usage" } as const]
          : []),
      ],
    },
  ];
}

export function ownerShopBookingPublicHref(shopSlug: string): string {
  return `/s/${encodeURIComponent(shopSlug)}/book`;
}

export const ownerNavIcons = { ExternalLink, Map };

export function isOwnerShopNavActive(pathname: string, href: string, base: string): boolean {
  if (href === base) return pathname === base || pathname === `${base}/`;
  return pathname === href || pathname.startsWith(`${href}/`);
}
