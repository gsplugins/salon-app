"use client";

import { LayoutDashboard, Settings2, Store, Users } from "lucide-react";
import { SidebarLayout, type NavItem } from "@/components/platform/sidebar-layout";

const items: NavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/settings", label: "Settings", icon: Settings2 },
  { href: "/admin/shops", label: "Shops", icon: Store },
  { href: "/admin/users", label: "Users", icon: Users },
];

export function AdminSidebarShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarLayout title="Super admin" items={items}>
      {children}
    </SidebarLayout>
  );
}
