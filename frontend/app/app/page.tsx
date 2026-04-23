import Link from "next/link";
import { ArrowRight, Calendar, Compass, LayoutDashboard, Shield } from "lucide-react";
import { AuthHeaderProfile } from "@/components/auth-header-profile";
import { AuthAccessPanel } from "./auth-access-panel";
import { AccountPhotoCard } from "./account-photo-card";

export const metadata = {
  title: "Portal hub — Prime Barbershop",
  description:
    "Role-based portal hub for customer, staff, manager, and super admin.",
};

export default function StaffAppPage() {
  return (
    <div className="min-h-[100dvh] text-slate-100">
      <header className="border-b border-slate-800 bg-[#0a1220]/95 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 pb-5 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                Account center
              </p>
              <h1 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                Lumière authentication workspace
              </h1>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <AuthHeaderProfile />
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Link
              href="/customer/home"
              className="card-clean group inline-flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
            >
              <span className="inline-flex items-center gap-2">
                <Compass className="h-4 w-4" />
                Customer panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/staff/dashboard"
              className="card-clean group inline-flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
            >
              <span className="inline-flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Staff panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/owner/dashboard"
              className="card-clean group inline-flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
            >
              <span className="inline-flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4" />
                Manager panel
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="/admin/dashboard"
              className="card-clean group inline-flex min-h-11 items-center justify-between px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
            >
              <span className="inline-flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Super admin
              </span>
              <ArrowRight className="h-4 w-4 opacity-60 transition group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
            <Link href="/platform" className="font-medium text-blue-300 hover:underline">
              Site map
            </Link>
            <span>•</span>
            <Link href="/" className="hover:text-blue-300">
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
              Real-life flow
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              Choose your portal, then continue with secure sign-in.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-300">
              Customers, barbers, managers, and admins all use one authentication system.
              If you are not signed in, use the right-side panel to go to login or registration.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Link
                href="/customer/home"
                className="card-clean px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
              >
                Customer booking and loyalty
              </Link>
              <Link
                href="/staff/dashboard"
                className="card-clean px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
              >
                Staff schedule and appointments
              </Link>
              <Link
                href="/owner/dashboard"
                className="card-clean px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
              >
                Manager operations and analytics
              </Link>
              <Link
                href="/admin/dashboard"
                className="card-clean px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-blue-400 hover:text-blue-200"
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
