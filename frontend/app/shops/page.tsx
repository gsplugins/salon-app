import type { Metadata } from "next";
import { Suspense } from "react";
import { ShopsBrowseClient } from "./shops-browse-client";

export const metadata: Metadata = {
  title: "Browse shops — Salon",
  description: "Find a barbershop location and book online.",
};

function BrowseFallback() {
  return (
    <div className="min-h-screen px-4 py-12">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="h-9 w-64 animate-pulse rounded-lg bg-blue-500/20" />
        <div className="h-10 w-full max-w-xl animate-pulse rounded-lg bg-blue-500/20" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-blue-500/20" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function ShopsBrowsePage() {
  return (
    <Suspense fallback={<BrowseFallback />}>
      <ShopsBrowseClient />
    </Suspense>
  );
}
