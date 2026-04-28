import Link from "next/link";
import { ArrowRight, Calendar, Compass, LayoutDashboard, Shield } from "lucide-react";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { AuthAccessPanel } from "./auth-access-panel";
import { AccountPhotoCard } from "./account-photo-card";

export const metadata = {
  title: "Portal hub — BarbarShop",
  description:
    "Role-based portal hub for customer, staff, manager, and super admin.",
};

export default function StaffAppPage() {
  return (
    <div className="min-h-[100dvh] bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="border-b border-[color:var(--border)] bg-[color:var(--surface-elevated)]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-primary)]">
                Account center
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-[color:var(--foreground)] sm:text-xl">
                BarbarShop authentication workspace
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <AuthHeaderProfile />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/customer/home"
              className="card-clean group inline-flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
            >
              <span className="inline-flex items-center gap-2">
                <Compass className="h-4 w-4" />
                Customer panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/staff/dashboard"
              className="card-clean group inline-flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
            >
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Staff panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/owner/dashboard"
              className="card-clean group inline-flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
            >
              <span className="inline-flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Manager panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/admin/dashboard"
              className="card-clean group inline-flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
            >
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Super admin
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[color:var(--caption)]">
            <Link href="/platform" className="font-medium text-[color:var(--brand-primary)] hover:underline">
              Site map
            </Link>
            <span>•</span>
            <Link href="/" className="hover:text-[color:var(--brand-primary)]">
              Home
            </Link>
            <span>•</span>
            <span>Phone-first login and role-based dashboards</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="section-wrap p-6 sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--brand-primary)]">
              Real-life flow
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
              Choose your portal, then continue with secure sign-in.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--paragraph)]">
              Customers, barbers, managers, and admins all use one authentication system.
              If you are not signed in, use the right-side panel to go to login or registration.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/customer/home"
                className="card-clean px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
              >
                Customer booking and loyalty
              </Link>
              <Link
                href="/staff/dashboard"
                className="card-clean px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
              >
                Staff schedule and appointments
              </Link>
              <Link
                href="/owner/dashboard"
                className="card-clean px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
              >
                Manager operations and analytics
              </Link>
              <Link
                href="/admin/dashboard"
                className="card-clean px-4 py-3 text-sm font-medium text-[color:var(--foreground)] transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
              >
                Platform-wide admin controls
              </Link>
            </div>
            <AccountPhotoCard />
          </section>
          <AuthAccessPanel />
        </div>
      </main>
    </div>
  );
}
