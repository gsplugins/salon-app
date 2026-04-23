import type { Metadata } from "next";
import { PublicHeader } from "@/components/public-header";
import { PlatformFeatureHub } from "@/components/platform/feature-hub";

export const metadata: Metadata = {
  title: "Site map — All features",
  description:
    "Navigate every area of the barbershop platform: public booking, customer, owner, barber, and admin.",
};

export default function PlatformMapPage() {
  return (
    <div className="min-h-screen text-slate-100">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <header className="section-wrap mb-10 max-w-2xl p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-blue-300">
            Navigation
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
            Site map
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Every public and signed-in area in one place. Replace demo IDs with a real shop id from{" "}
            <span className="font-mono text-xs">/shops</span> when testing locally.
          </p>
        </header>
        <PlatformFeatureHub />
      </main>
    </div>
  );
}
