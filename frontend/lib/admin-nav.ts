import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Bell,
  CreditCard,
  LayoutDashboard,
  Link2,
  ScrollText,
  Settings,
  Store,
  Users,
  Webhook,
  Wrench,
} from "lucide-react";

export type AdminNavItem = { href: string; label: string; icon: LucideIcon };

export const ADMIN_NAV: AdminNavItem[] = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/general", label: "General", icon: Settings },
  { href: "/admin/subscriptions", label: "Subscriptions", icon: CreditCard },
  { href: "/admin/shops", label: "Shops", icon: Store },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/billing", label: "Billing", icon: CreditCard },
  { href: "/admin/notifications", label: "Notifications", icon: Bell },
  { href: "/admin/analytics", label: "Analytics", icon: Activity },
  { href: "/admin/integrations", label: "Integrations", icon: Link2 },
  { href: "/admin/webhooks", label: "Webhooks", icon: Webhook },
  { href: "/admin/audit-logs", label: "Audit logs", icon: ScrollText },
  { href: "/admin/tools", label: "Tools (bKash)", icon: Wrench },
];
