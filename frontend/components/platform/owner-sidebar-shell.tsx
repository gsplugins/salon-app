"use client";

import {
  Calendar,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  MessageSquare,
  Package,
  Scissors,
  Store,
  Users,
} from "lucide-react";
import { SidebarLayout, type NavItem } from "@/components/platform/sidebar-layout";

const items: NavItem[] = [
  { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/app", label: "Account & shop", icon: Calendar },
  { href: "/owner/services", label: "Services", icon: Scissors },
  { href: "/owner/staff", label: "Staff", icon: Users },
  { href: "/owner/shops", label: "Branches", icon: Store },
  { href: "/owner/queue", label: "Walk-in queue", icon: ListOrdered },
  { href: "/owner/reports", label: "Reports", icon: LineChart },
  { href: "/owner/inventory", label: "Inventory", icon: Package },
  { href: "/owner/reviews", label: "Reviews", icon: MessageSquare },
];

export function OwnerSidebarShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarLayout title="Shop owner" items={items}>
      {children}
    </SidebarLayout>
  );
}
