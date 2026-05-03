"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LocateFixed, MapPin, Search, Store } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PublicHeader } from "@/components/public-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicShopsDirectory, formatApiError, type PublicShopListRow } from "@/lib/salon-api";

type UserCoords = { lat: number; lng: number };
type ShopWithDistance = PublicShopListRow & { distanceKm?: number };

export type ShopsBrowseClientProps = {
  /** When set, first paint uses server data and skips one duplicate client fetch on mount. */
  initialRows?: PublicShopListRow[] | null;
};

function toNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function haversineKm(a: UserCoords, b: UserCoords): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const aa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(aa), Math.sqrt(1 - aa));
}

function googleMapPlaceUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function googleMapDirectionsUrl(origin: UserCoords, dest: UserCoords): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${dest.lat},${dest.lng}&travelmode=driving`;
}

export function ShopsBrowseClient({ initialRows = null }: ShopsBrowseClientProps) {
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
  const [rows, setRows] = useState<PublicShopListRow[] | null>(initialRows);
  const [sortedRows, setSortedRows] = useState<ShopWithDistance[] | null>(null);
  const [selectedMapShopId, setSelectedMapShopId] = useState<number | null>(null);
  const [busy, setBusy] = useState(initialRows === null);
  const skipInitialClientFetch = useRef(initialRows !== null);
  const [coords, setCoords] = useState<UserCoords | null>(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchPublicShopsDirectory({
      search: q || undefined,
      division: division || undefined,
      district: district || undefined,
      city: city || undefined,
      // Keep a wider pool so nearby sort is meaningful.
      perPage: 48,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data.data);
  }, [q, division, district, city]);

  const locateUser = useCallback(
    (silent = false) => {
      if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
        if (!silent) toast.error("Geolocation is not supported in this browser.");
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLocating(false);
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          if (!silent) toast.success("Showing nearest shops around you.");
        },
        () => {
          setLocating(false);
          if (!silent) toast.error("Could not access your location.");
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 120000 }
      );
    },
    []
  );

  useEffect(() => {
    if (skipInitialClientFetch.current) {
      skipInitialClientFetch.current = false;
      return;
    }
    void load();
  }, [load]);

  useEffect(() => {
    // Attempt location once; keep silent if blocked.
    locateUser(true);
  }, [locateUser]);

  useEffect(() => {
    if (!rows) {
      setSortedRows(rows);
      return;
    }
    if (!coords) {
      setSortedRows(rows);
      return;
    }
    const withDistance: ShopWithDistance[] = rows.map((shop) => {
      const lat = toNumber(shop.latitude);
      const lng = toNumber(shop.longitude);
      if (lat == null || lng == null) return shop;
      return { ...shop, distanceKm: haversineKm(coords, { lat, lng }) };
    });
    withDistance.sort((a, b) => {
      const da = a.distanceKm ?? Number.POSITIVE_INFINITY;
      const db = b.distanceKm ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      return a.id - b.id;
    });
    setSortedRows(withDistance);
  }, [rows, coords]);

  useEffect(() => {
    if (!sortedRows || sortedRows.length === 0) {
      setSelectedMapShopId(null);
      return;
    }
    if (selectedMapShopId != null && sortedRows.some((s) => s.id === selectedMapShopId)) return;
    const firstWithCoords = sortedRows.find((s) => toNumber(s.latitude) != null && toNumber(s.longitude) != null);
    setSelectedMapShopId(firstWithCoords?.id ?? sortedRows[0].id);
  }, [sortedRows, selectedMapShopId]);

  const nearbyWithCoords = (sortedRows ?? []).filter((s) => toNumber(s.latitude) != null && toNumber(s.longitude) != null);
  const selectedMapShop =
    nearbyWithCoords.find((s) => s.id === selectedMapShopId) ?? nearbyWithCoords[0] ?? null;
  const selectedLat = selectedMapShop ? toNumber(selectedMapShop.latitude) : null;
  const selectedLng = selectedMapShop ? toNumber(selectedMapShop.longitude) : null;
  const selectedMapEmbedUrl =
    selectedLat != null && selectedLng != null
      ? `https://maps.google.com/maps?q=${selectedLat},${selectedLng}&z=14&output=embed`
      : null;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    setQ(draft.trim());
  }

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-semibold tracking-tight text-[color:var(--foreground)]">Find your nearest barbershop</h1>
        <p className="mt-2 text-sm text-[color:var(--paragraph)]">
          Search by area, compare verified shops, then book your preferred slot.
        </p>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => locateUser(false)}
            disabled={locating}
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 text-sm font-medium text-[color:var(--foreground)] transition hover:bg-[color:var(--surface-elevated)] disabled:opacity-60"
          >
            <LocateFixed className="h-4 w-4" />
            {locating ? "Detecting location..." : coords ? "Refresh nearby results" : "Use my location"}
          </button>
        </div>

        <form onSubmit={submitSearch} className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--caption)]" />
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Search by shop name or area..."
              className="w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] py-2.5 pl-10 pr-4 text-sm text-[color:var(--foreground)] shadow-sm outline-none ring-blue-500/20 focus:border-blue-400 focus:ring-2"
            />
          </div>
          <input
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            placeholder="Division (optional)"
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--foreground)] shadow-sm outline-none ring-blue-500/20 focus:border-blue-400 focus:ring-2"
          />
          <input
            value={district}
            onChange={(e) => setDistrict(e.target.value)}
            placeholder="District (optional)"
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--foreground)] shadow-sm outline-none ring-blue-500/20 focus:border-blue-400 focus:ring-2"
          />
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="City / neighborhood"
            className="rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5 text-sm text-[color:var(--foreground)] shadow-sm outline-none ring-blue-500/20 focus:border-blue-400 focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-xl bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-400 lg:col-span-1"
          >
            Find shops
          </button>
        </form>

        {!busy && nearbyWithCoords.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold text-[color:var(--foreground)]">Nearby salons on Google Maps</h2>
                <p className="text-xs text-[color:var(--caption)]">
                  Showing registered nearby salons with map links and directions.
                </p>
              </div>
              {selectedMapShop && selectedLat != null && selectedLng != null ? (
                <div className="flex flex-wrap gap-2">
                  <a
                    href={googleMapPlaceUrl(selectedLat, selectedLng)}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)]"
                  >
                    Open location
                  </a>
                  {coords ? (
                    <a
                      href={googleMapDirectionsUrl(coords, { lat: selectedLat, lng: selectedLng })}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface)] px-3 py-1.5 text-xs font-medium text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)]"
                    >
                      Directions
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <div className="space-y-2 lg:col-span-1">
                {nearbyWithCoords.slice(0, 12).map((shop) => {
                  const lat = toNumber(shop.latitude)!;
                  const lng = toNumber(shop.longitude)!;
                  const active = selectedMapShopId === shop.id;
                  return (
                    <button
                      key={shop.id}
                      type="button"
                      onClick={() => setSelectedMapShopId(shop.id)}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        active
                          ? "border-blue-400 bg-[color:color-mix(in srgb, var(--brand-primary) 12%, transparent)] text-[color:var(--foreground)]"
                          : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)]"
                      }`}
                    >
                      <p className="truncate text-sm font-semibold">{shop.name}</p>
                      <p className="mt-0.5 text-xs text-[color:var(--caption)]">
                        {typeof shop.distanceKm === "number"
                          ? shop.distanceKm < 1
                            ? `${Math.round(shop.distanceKm * 1000)} m away`
                            : `${shop.distanceKm.toFixed(1)} km away`
                          : "Distance unavailable"}
                      </p>
                      <p className="mt-1 truncate text-xs text-[color:var(--caption)]">
                        {[shop.city, shop.district].filter(Boolean).join(", ") || "Registered salon"}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--brand-primary)]">
                        {lat}, {lng}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="lg:col-span-2">
                {selectedMapEmbedUrl ? (
                  <iframe
                    title="Nearby salon map"
                    src={selectedMapEmbedUrl}
                    className="h-[360px] w-full rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)]"
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="flex h-[360px] items-center justify-center rounded-xl border border-[color:var(--border)] bg-[color:var(--surface-elevated)] text-sm text-[color:var(--caption)]">
                    No geocoded salon locations available yet.
                  </div>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {busy || sortedRows === null ? (
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="card-clean p-5">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="mt-3 h-4 w-full" />
                <Skeleton className="mt-2 h-4 w-2/3" />
              </li>
            ))}
          </ul>
        ) : sortedRows.length === 0 ? (
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
            {sortedRows.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/shops/${s.id}`}
                  className="card-clean flex h-full flex-col p-5 transition hover:border-blue-400"
                >
                  {s.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                    <img src={s.logo_url} alt={`${s.name} logo`} className="mb-3 h-10 w-10 rounded-full object-cover" />
                  ) : null}
                  <h2 className="text-lg font-semibold text-[color:var(--foreground)]">{s.name}</h2>
                  {s.description ? (
                    <p className="mt-2 line-clamp-2 text-sm text-[color:var(--paragraph)]">
                      {s.description}
                    </p>
                  ) : null}
                  {s.address ? (
                    <p className="mt-3 flex items-start gap-2 text-sm text-[color:var(--paragraph)]">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-primary)]" />
                      {s.address}
                    </p>
                  ) : (
                    <p className="mt-3 text-sm text-[color:var(--caption)]">Online booking available</p>
                  )}
                  {typeof s.distanceKm === "number" ? (
                    <p className="mt-2 text-xs font-medium text-[color:var(--brand-primary)]">
                      {s.distanceKm < 1 ? `${Math.round(s.distanceKm * 1000)} m away` : `${s.distanceKm.toFixed(1)} km away`}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-[color:var(--caption)]">
                    {[s.city, s.district, s.division].filter(Boolean).join(", ") || "Location details coming soon"}
                  </p>
                  <span className="mt-4 text-sm font-medium text-[color:var(--brand-primary)]">
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
