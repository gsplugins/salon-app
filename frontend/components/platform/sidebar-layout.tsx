"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { AuthHeaderProfile } from "@/components/auth-header-profile";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export function SidebarLayout(props: {
  title: string;
  items: NavItem[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { title, items, children } = props;

  return (
    <div className="min-h-[100dvh] bg-zinc-50 text-zinc-800 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 md:flex-row md:gap-8 md:py-8 lg:gap-10">
        <aside className="w-full shrink-0 md:sticky md:top-6 md:max-h-[calc(100dvh-3rem)] md:w-56 md:self-start md:overflow-y-auto">
          <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-rose-800 dark:text-rose-200">
              {title}
            </p>
            <p className="mt-1 text-xs text-zinc-800 dark:text-zinc-400">Workspace</p>
            <nav className="mt-4 space-y-1.5">
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
                  className={`flex min-h-10 items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm font-medium transition touch-manipulation active:scale-[0.99] ${
                    active
                      ? "bg-zinc-900 text-white shadow dark:bg-rose-100 dark:text-zinc-800"
                      : "text-zinc-800 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  {item.label}
                </Link>
              );
            })}
            </nav>
            <div className="mt-5 border-t border-zinc-200 pt-4 dark:border-zinc-700">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-800">
                More
              </p>
              <div className="mt-2 flex flex-col gap-1 text-xs font-medium">
                <Link
                  href="/platform"
                  className="rounded-lg px-2 py-1.5 text-rose-800 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-950/30"
                >
                  Site map
                </Link>
                <Link
                  href="/"
                  className="rounded-lg px-2 py-1.5 text-zinc-800 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  Marketing home
                </Link>
              </div>
            </div>
          </div>
        </aside>
        <main className="min-w-0 flex-1 rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex flex-wrap items-center justify-end gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 md:px-6">
            <AuthHeaderProfile />
          </div>
          <div className="p-4 md:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
