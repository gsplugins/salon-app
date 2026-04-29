"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export type PortalNavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  exact?: boolean;
  disabled?: boolean;
  disabledHint?: string;
};

export type PortalPanelHeaderModel =
  | {
      state: "ready";
      avatarUrl?: string | null;
      avatarFallback: string;
      title: string;
      subtitle?: string;
      badge?: React.ReactNode;
    }
  | { state: "loading" };

export function PortalPanelShell(props: {
  children: React.ReactNode;
  brandLabel: string;
  brandHref: string;
  /** Shown under brand in desktop sidebar */
  sidebarContextLine?: string;
  /** Primary links (mobile bottom bar + top of sidebar) */
  primaryNav: PortalNavItem[];
  /** Extra links in sidebar + mobile drawer below divider */
  secondaryNav?: PortalNavItem[];
  header: PortalPanelHeaderModel;
  /** Right side of header row (notifications, theme, profile, etc.) */
  headerTrailing?: React.ReactNode;
  /** Link at bottom of sidebar / drawer */
  footerLink?: { href: string; label: string };
  /** Second optional footer link */
  footerLink2?: { href: string; label: string };
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const secondary = props.secondaryNav ?? [];
  const drawerItems = [...props.primaryNav, ...secondary];

  return (
    <div className="min-h-[100dvh] bg-[color:var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto flex w-full max-w-6xl lg:max-w-none">
        <aside className="sticky top-0 hidden h-[100dvh] w-56 shrink-0 flex-col border-r border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-4 lg:flex">
          <div className="mb-4 px-2">
            <Link
              href={props.brandHref}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-primary)]"
            >
              {props.brandLabel}
            </Link>
            {props.sidebarContextLine ? (
              <p className="mt-1 truncate text-sm font-semibold text-[color:var(--foreground)]">{props.sidebarContextLine}</p>
            ) : null}
          </div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {props.primaryNav.map((item) => (
              <PortalNavLink key={item.href} {...item} pathname={pathname} />
            ))}
            {secondary.length > 0 ? (
              <>
                <div className="my-2 border-t border-[color:var(--border)] pt-2" />
                {secondary.map((item) => (
                  <PortalNavLink key={item.href} {...item} pathname={pathname} />
                ))}
              </>
            ) : null}
          </nav>
          {props.footerLink ? (
            <Link
              href={props.footerLink.href}
              className="mt-3 rounded-xl px-3 py-2 text-xs font-medium text-[color:var(--paragraph)] transition hover:text-[color:var(--brand-primary)]"
            >
              {props.footerLink.label}
            </Link>
          ) : null}
          {props.footerLink2 ? (
            <Link
              href={props.footerLink2.href}
              className="mt-1 rounded-xl px-3 py-2 text-xs font-medium text-[color:var(--paragraph)] transition hover:text-[color:var(--brand-primary)]"
            >
              {props.footerLink2.label}
            </Link>
          ) : null}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col pb-24 lg:pb-6">
          <header className="sticky top-0 z-30 border-b border-[color:var(--border)] bg-[color:var(--background)] px-4 py-3 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 min-w-11 shrink-0 p-0 lg:hidden"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                {props.header.state === "loading" ? (
                  <>
                    <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
                    <div className="min-w-0 flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[color:var(--border)] bg-[color:var(--surface-elevated)]">
                      {props.header.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element -- portal avatars may be external URLs
                        <img src={props.header.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-[color:var(--foreground)]">
                          {props.header.avatarFallback}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[color:var(--foreground)]">{props.header.title}</p>
                      {props.header.subtitle ? (
                        <p className="truncate text-xs text-[color:var(--paragraph)]">{props.header.subtitle}</p>
                      ) : null}
                    </div>
                    {props.header.badge ? (
                      <span className="hidden shrink-0 sm:inline-flex">{props.header.badge}</span>
                    ) : null}
                    {props.headerTrailing ? <div className="flex shrink-0 items-center gap-2">{props.headerTrailing}</div> : null}
                  </>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 sm:px-6">{props.children}</main>
        </div>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close menu" onClick={() => setMobileOpen(false)} />
        <div className="absolute left-0 top-0 flex h-full w-[min(20rem,92vw)] flex-col bg-[color:var(--surface)] p-4 shadow-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-primary)]">Menu</p>
            <nav className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto">
              {drawerItems.map((item) => (
                <PortalNavLink key={item.href} {...item} pathname={pathname} onClick={() => setMobileOpen(false)} />
              ))}
            </nav>
            {props.footerLink ? (
              <Link
                href={props.footerLink.href}
                className="mt-2 text-sm text-[color:var(--paragraph)]"
                onClick={() => setMobileOpen(false)}
              >
                {props.footerLink.label}
              </Link>
            ) : null}
            {props.footerLink2 ? (
              <Link
                href={props.footerLink2.href}
                className="mt-1 text-sm text-[color:var(--paragraph)]"
                onClick={() => setMobileOpen(false)}
              >
                {props.footerLink2.label}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-[color:var(--border)] bg-[color:color-mix(in srgb, var(--surface) 92%, transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between gap-0 px-1 pt-1">
          {props.primaryNav.map((item) => {
            const active = !item.disabled && (pathname === item.href || pathname.startsWith(`${item.href}/`));
            const Icon = item.icon;
            return (
              <li key={item.href} className="min-w-0 flex-1">
                {item.disabled ? (
                  <div
                    className="flex min-h-[52px] cursor-not-allowed flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-semibold text-zinc-400 opacity-70"
                    title={item.disabledHint}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate text-center leading-tight">{item.label}</span>
                  </div>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      "flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-lg px-0.5 py-1 text-[10px] font-semibold",
                      active ? "text-[color:var(--brand-primary)]" : "text-[color:var(--caption)]"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 shrink-0", active ? "text-[color:var(--brand-primary)]" : "")} />
                    <span className="truncate text-center leading-tight">{item.label}</span>
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function PortalNavLink(props: PortalNavItem & { pathname: string; onClick?: () => void }) {
  if (props.disabled) {
    const Icon = props.icon;
    return (
      <div
        className="flex min-h-11 cursor-not-allowed items-center gap-3 rounded-xl border border-dashed border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-400 opacity-80 dark:border-zinc-700 dark:text-zinc-500"
        title={props.disabledHint}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-70" />
        <span className="truncate">{props.label}</span>
      </div>
    );
  }
  const active = props.exact
    ? props.pathname === props.href || props.pathname === `${props.href}/`
    : props.pathname === props.href || props.pathname.startsWith(`${props.href}/`);
  const Icon = props.icon;
  return (
    <Link
      href={props.href}
      onClick={props.onClick}
      className={cn(
        "flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-[color:var(--brand-primary)] text-white shadow-sm"
          : "text-[color:var(--foreground)] hover:bg-[color:color-mix(in_srgb,var(--brand-glow)_14%,var(--surface-elevated))]"
      )}
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90" />
      <span className="truncate">{props.label}</span>
    </Link>
  );
}
