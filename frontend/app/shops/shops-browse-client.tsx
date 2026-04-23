"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { MapPin, Search, Store } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/public-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicShopsDirectory, formatApiError, type PublicShopListRow } from "@/lib/salon-api";

export function ShopsBrowseClient() {
  const sp = useSearchParams();
  const initialQ = sp.get("q") ?? "";
  const initialDivision = sp.get("division") ?? "";
  const initialDistrict = sp.get("district") ?? "";
  const initialCity = sp.get("city") ?? "";
  const [q, setQ] = useState(initialQ);
  const [draft, setDraft] = useState(initialQ);
  const [division, setDivision] = useState(initialDivision);
  const [district, setDistrict] = useState(initialDistrict);
  const [city, setCity] = useState(initialCity);
  const [rows, setRows] = useState<PublicShopListRow[] | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchPublicShopsDirectory({
      search: q || undefined,
      division: division || undefined,
      district: district || undefined,
      city: city || undefined,
      perPage: 24,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data.data);
  }, [q, division, district, city]);

  useEffect(() => {
     
    void load();
  }, [load]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(draft.trim());
  }

  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">
          Shops
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Search by name/address and filter by division, district, and city.
        </p>

        <form onSubmit={submitSearch} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search shops…"
              className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm outline-none ring-rose-500/30 focus:border-rose-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
          <input
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            placeholder="Division"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none ring-rose-500/30 focus:border-rose-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="District"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none ring-rose-500/30 focus:border-rose-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City"
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm shadow-sm outline-none ring-rose-500/30 focus:border-rose-400 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-rose-100 dark:text-zinc-900 lg:col-span-1"
          >
            Apply filters
          </button>
        </form>

        {busy || rows === null ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={Store}
              title="No shops match"
              description="Try another search term, or ask your favorite salon to enable public booking."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setDraft("");
                    setQ("");
                  }}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
                >
                  Clear search
                </button>
              }
            />
          </div>
        ) : (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/shops/${s.id}`}
                  className="flex h-full flex-col rounded-2xl border border-rose-100/80 bg-white p-5 shadow-sm transition hover:border-rose-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                    <img src={s.logo_url} alt={`${s.name} logo`} className="mb-3 h-10 w-10 rounded-full object-cover" />
                  ) : null}
                  <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{s.name}</h2>
                  {s.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {s.description}
                    </p>
                  ) : null}
                  {s.address ? (
                    <p className="mt-3 flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-700/80" />
                      {s.address}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-zinc-500">Slug: {s.slug}</p>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">
                    {[s.city, s.district, s.division].filter(Boolean).join(", ") || "Location not tagged"}
                  </p>
                  <span className="mt-4 text-sm font-medium text-rose-800 dark:text-rose-200">
                    View details →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
