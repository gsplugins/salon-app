"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export function SidebarLayout(props: {
  title: string;
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { title, items, children } = props;

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-10 md:py-8">
        <aside className="w-full shrink-0 md:w-56">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-200">
            {title}
          </p>
          <nav className="mt-4 space-y-1">
            {items.map((item) => {
              const active =
                item.href === "/app"
                  ? pathname === "/app"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-zinc-900 text-white shadow dark:bg-rose-100 dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-white hover:shadow-sm dark:text-zinc-300 dark:hover:bg-zinc-900"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 flex flex-col gap-2 text-xs font-medium">
            <Link href="/platform" className="text-rose-800 hover:underline dark:text-rose-200">
              Site map
            </Link>
            <Link href="/" className="text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
              Marketing home
            </Link>
          </div>
        </aside>
        <main className="min-w-0 flex-1 rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 md:px-6">
            <AuthHeaderProfile variant="compact" />
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
          </div>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
