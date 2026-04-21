import Link from "next/link";
import { ArrowRight, Calendar, Compass, LayoutDashboard, Shield } from "lucide-react";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthAccessPanel } from "./auth-access-panel";

export const metadata = {
  title: "Portal hub — Prime Barbershop",
  description:
    "Role-based portal hub for customer, staff, manager, and super admin.",
};

export default function StaffAppPage() {
  return (
    <div className="min-h-[100dvh] bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-zinc-200/80 bg-zinc-50/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800/80 dark:text-rose-200/80">
                Account center
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-white sm:text-xl">
                Lumière authentication workspace
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <AuthHeaderProfile variant="compact" />
              <ThemeToggle />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/customer/home"
              className="group inline-flex min-h-11 items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-rose-200 hover:text-rose-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-rose-900/50 dark:hover:text-rose-100"
            >
              <span className="inline-flex items-center gap-2">
                <Compass className="h-4 w-4" />
                Customer panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/staff/dashboard"
              className="group inline-flex min-h-11 items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-rose-200 hover:text-rose-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-rose-900/50 dark:hover:text-rose-100"
            >
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Staff panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/owner/dashboard"
              className="group inline-flex min-h-11 items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-rose-200 hover:text-rose-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-rose-900/50 dark:hover:text-rose-100"
            >
              <span className="inline-flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Manager panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/admin/dashboard"
              className="group inline-flex min-h-11 items-center justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700 shadow-sm transition hover:border-rose-200 hover:text-rose-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-rose-900/50 dark:hover:text-rose-100"
            >
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Super admin
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <Link href="/platform" className="font-medium text-rose-800 hover:underline dark:text-rose-200">
              Site map
            </Link>
            <span>•</span>
            <Link href="/" className="hover:text-rose-800 dark:hover:text-rose-200">
              Home
            </Link>
            <span>•</span>
            <span>Phone-first login and role-based dashboards</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="rounded-3xl border border-zinc-200/90 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/60 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-rose-800/80 dark:text-rose-200/80">
              Real-life flow
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
              Choose your portal, then continue with secure sign-in.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Customers, barbers, managers, and admins all use one authentication system.
              If you are not signed in, use the right-side panel to go to login or registration.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/customer/home"
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-rose-200 hover:text-rose-900 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
              >
                Customer booking and loyalty
              </Link>
              <Link
                href="/staff/dashboard"
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-rose-200 hover:text-rose-900 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
              >
                Staff schedule and appointments
              </Link>
              <Link
                href="/owner/dashboard"
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-rose-200 hover:text-rose-900 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
              >
                Manager operations and analytics
              </Link>
              <Link
                href="/admin/dashboard"
                className="rounded-2xl border border-zinc-200 bg-zinc-50/70 px-4 py-3 text-sm font-medium text-zinc-700 transition hover:border-rose-200 hover:text-rose-900 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-200"
              >
                Platform-wide admin controls
              </Link>
            </div>
          </section>
          <AuthAccessPanel />
        </div>
      </main>
    </div>
  );
}
