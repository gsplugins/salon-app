import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import { PublicPlansClient } from "./public-plans-client";

export const metadata: Metadata = {
  title: "Plans — BarbarShop",
  description: "Compare Free, Starter, Pro, and Enterprise plans. Scheduling, POS, analytics, and more.",
};

export default function PlansPage() {
  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <PublicHeader />
      <main className="mx-auto max-w-[1200px] px-4 py-12 sm:px-6 sm:py-14">
        <header className="mb-12 max-w-2xl text-center sm:mx-auto sm:mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--brand-primary)]">Pricing</p>
          <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight text-[color:var(--foreground)] sm:text-4xl">
            Plans that grow with your shop
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-[color:var(--paragraph)]">
            Transparent pricing across scheduling, bookings, POS, and operations. Upgrade anytime from your dashboard.
          </p>
        </header>
        <PublicPlansClient />
      </main>
    </div>
  );
}
