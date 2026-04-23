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
    <div className="min-h-screen text-slate-100">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-white">Find your nearest barbershop</h1>
        <p className="mt-2 text-sm text-slate-300">
          Search by area, compare verified shops, then book your preferred slot.
        </p>

        <form onSubmit={submitSearch} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search by shop name or area..."
              className="w-full rounded-xl border border-slate-700 bg-slate-900 py-2.5 pl-10 pr-4 text-sm text-slate-100 shadow-sm outline-none ring-blue-500/20 focus:border-blue-400 focus:ring-2"
            />
          </div>
          <input
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            placeholder="Division (optional)"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 shadow-sm outline-none ring-blue-500/20 focus:border-blue-400 focus:ring-2"
          />
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="District (optional)"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 shadow-sm outline-none ring-blue-500/20 focus:border-blue-400 focus:ring-2"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City / neighborhood"
            className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm text-slate-100 shadow-sm outline-none ring-blue-500/20 focus:border-blue-400 focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-400 lg:col-span-1"
          >
            Find shops
          </button>
        </form>

        {busy || rows === null ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="card-clean p-5">
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
              description="Try another area or remove filters to see more registered barbershops."
              action={
                <button
                  type="button"
                  onClick={() => {
                    setDraft("");
                    setQ("");
                  }}
                  className="rounded-full bg-blue-500 px-4 py-2 text-sm font-semibold text-white"
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
                  className="card-clean flex h-full flex-col p-5 transition hover:border-blue-400"
                >
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                    <img src={s.logo_url} alt={`${s.name} logo`} className="mb-3 h-10 w-10 rounded-full object-cover" />
                  ) : null}
                  <h2 className="text-lg font-semibold text-white">{s.name}</h2>
                  {s.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-300">
                      {s.description}
                    </p>
                  ) : null}
                  {s.address ? (
                    <p className="mt-3 flex items-start gap-2 text-sm text-slate-300">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-300" />
                      {s.address}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-slate-400">Online booking available</p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">
                    {[s.city, s.district, s.division].filter(Boolean).join(", ") || "Location details coming soon"}
                  </p>
                  <span className="mt-4 text-sm font-medium text-blue-300">
                    View shop and book →
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
