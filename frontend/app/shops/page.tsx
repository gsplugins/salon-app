import type { Metadata } from "next";
import { Suspense } from "react";
import { fetchPublicShopsDirectoryOnServer } from "@/lib/server/fetch-public-shops-directory";
import { ShopsBrowseClient } from "./shops-browse-client";

export const metadata: Metadata = {
  title: "Browse shops — Salon",
  description: "Find a barbershop location and book online.",
};

/** Align with `/api/public/shops` ISR so HTML often includes the first directory paint. */
export const revalidate = 60;

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

export default async function ShopsBrowsePage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const division = typeof sp.division === "string" ? sp.division : "";
  const district = typeof sp.district === "string" ? sp.district : "";
  const city = typeof sp.city === "string" ? sp.city : "";
  const dir = await fetchPublicShopsDirectoryOnServer({
    search: q || undefined,
    division: division || undefined,
    district: district || undefined,
    city: city || undefined,
    perPage: 48
  });
  const initialRows = dir.ok ? dir.rows : null;

  return (
    <Suspense fallback={<BrowseFallback />}>
      <ShopsBrowseClient initialRows={initialRows} />
    </Suspense>
  );
}
