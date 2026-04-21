import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  Calendar,
  ClipboardList,
  Crown,
  History,
  LayoutDashboard,
  LineChart,
  ListOrdered,
  MapPin,
  MessageSquare,
  Package,
  QrCode,
  Scissors,
  Shield,
  Store,
  Ticket,
  UserCircle,
  Users,
} from "lucide-react";

type HubSection = {
  title: string;
  description: string;
  items: { href: string; label: string; hint?: string; icon: LucideIcon }[];
};

const SECTIONS: HubSection[] = [
  {
    title: "Discover & book",
    description: "No login required",
    items: [
      { href: "/", label: "Home", icon: MapPin },
      { href: "/shops", label: "Browse all shops", icon: Store },
      { href: "/platform", label: "This page (site map)", icon: MapPin },
      { href: "/s/demo/book", label: "Book by shop slug (demo)", hint: "Use your shop slug from the API", icon: Calendar },
      { href: "/book/1", label: "Book by shop id", hint: "Numeric id, e.g. from shop detail URL", icon: Ticket },
      { href: "/barbers/1", label: "Stylist profile (sample id)", icon: UserCircle },
    ],
  },
  {
    title: "Customers",
    description: "Register at /app, then use your dashboard",
    items: [
      { href: "/customer/dashboard", label: "Customer portal", icon: LayoutDashboard },
      { href: "/queue/1", label: "Live queue (replace shop id)", icon: QrCode },
    ],
  },
  {
    title: "Shop owner",
    description: "Subscription + JWT — full admin under /owner and live calendar at /app",
    items: [
      { href: "/owner/dashboard", label: "Overview & KPIs", icon: LayoutDashboard },
      { href: "/app", label: "Calendar, bookings & walk-ins", hint: "Primary day-to-day console", icon: Calendar },
      { href: "/owner/services", label: "Services & pricing", icon: Scissors },
      { href: "/owner/staff", label: "Staff", icon: Users },
      { href: "/owner/shops", label: "Branches", icon: Store },
      { href: "/owner/queue", label: "Walk-in queue control", icon: ListOrdered },
      { href: "/owner/reports", label: "Analytics & CSV export", icon: LineChart },
      { href: "/owner/inventory", label: "Inventory", icon: Package },
      { href: "/owner/reviews", label: "Reviews & replies", icon: MessageSquare },
    ],
  },
  {
    title: "Barber (staff)",
    description: "Staff accounts linked to salon_staff",
    items: [
      { href: "/staff/dashboard", label: "Staff portal (stylists & managers)", icon: Calendar },
      { href: "/staff/appointments", label: "Staff appointments", icon: History },
    ],
  },
  {
    title: "Platform admin",
    description: "Super admin only",
    items: [
      { href: "/admin/dashboard", label: "Overview", icon: Shield },
      { href: "/admin/shops", label: "Shops", icon: Store },
      { href: "/admin/users", label: "Users", icon: Users },
      { href: "/app", label: "JWT tools (bKash, extend subs, …)", hint: "Log in as super admin", icon: Crown },
    ],
  },
  {
    title: "Account & API",
    description: "Authentication entry",
    items: [{ href: "/app", label: "Sign in / register", hint: "Customers, owners, barbers, admins", icon: ClipboardList }],
  },
];

export function PlatformFeatureHub() {
  return (
    <div className="space-y-12">
      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{section.title}</h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{section.description}</p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.href + item.label}>
                  <Link
                    href={item.href}
                    className="flex gap-3 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-rose-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/60 dark:hover:border-rose-900/50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-medium text-zinc-900 dark:text-white">{item.label}</span>
                      {item.hint ? (
                        <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{item.hint}</span>
                      ) : (
                        <span className="mt-0.5 block font-mono text-[11px] text-zinc-400 dark:text-zinc-500">
                          {item.href}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
