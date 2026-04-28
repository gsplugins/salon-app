"use client";

import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";

type MapShop = {
  id: number;
  name: string;
  latitude: string | null;
  longitude: string | null;
  address?: string | null;
  google_maps_url?: string | null;
  city?: string | null;
  district?: string | null;
};

function toNumber(v: string | null | undefined): number | null {
  if (typeof v !== "string") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function googleMapPlaceUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

export function HomeShopsMapSection({ shops }: { shops: MapShop[] }) {
  const mapShops = useMemo(
    () =>
      shops
        .map((s) => {
          const lat = toNumber(s.latitude);
          const lng = toNumber(s.longitude);
          const fallbackQuery = s.address?.trim() || [s.name, s.city, s.district].filter(Boolean).join(", ");
          return {
            ...s,
            lat,
            lng,
            fallbackQuery,
          };
        })
        .filter((s) => Boolean((s.lat != null && s.lng != null) || s.google_maps_url || s.fallbackQuery)),
    [shops]
  );

  const [selectedId, setSelectedId] = useState<number | null>(mapShops[0]?.id ?? null);
  const selected = mapShops.find((s) => s.id === selectedId) ?? mapShops[0] ?? null;
  const embedUrl = useMemo(() => {
    if (!selected) return null;
    if (selected.lat != null && selected.lng != null) {
      return `https://maps.google.com/maps?q=${selected.lat},${selected.lng}&z=13&output=embed`;
    }
    if (selected.google_maps_url && /^https?:\/\//i.test(selected.google_maps_url)) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(selected.google_maps_url)}&z=13&output=embed`;
    }
    if (selected.fallbackQuery) {
      return `https://maps.google.com/maps?q=${encodeURIComponent(selected.fallbackQuery)}&z=13&output=embed`;
    }
    return null;
  }, [selected]);

  if (mapShops.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6" aria-labelledby="registered-map-heading">
      <div className="mb-4">
        <h2 id="registered-map-heading" className="text-2xl font-semibold text-[color:var(--foreground)]">
          Registered shops on map
        </h2>
        <p className="mt-1 text-sm text-[color:var(--paragraph)]">
          Browse all registered shop locations and open directly in Google Maps.
        </p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-1">
          {mapShops.map((shop) => {
            const active = selected?.id === shop.id;
            return (
              <button
                key={shop.id}
                type="button"
                onClick={() => setSelectedId(shop.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? "border-blue-400 bg-[color:color-mix(in srgb, var(--brand-primary) 12%, transparent)] text-[color:var(--foreground)]"
                    : "border-[color:var(--border)] bg-[color:var(--surface)] text-[color:var(--foreground)] hover:bg-[color:var(--surface-elevated)]"
                }`}
              >
                <p className="truncate text-sm font-semibold">{shop.name}</p>
                <p className="mt-0.5 truncate text-xs text-[color:var(--caption)]">
                  {[shop.city, shop.district].filter(Boolean).join(", ") || "Registered shop"}
                </p>
              </button>
            );
          })}
        </div>
        <div className="lg:col-span-2">
          {embedUrl ? (
            <iframe
              title="Registered shops map"
              src={embedUrl}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-[380px] w-full rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]"
            />
          ) : null}
          {selected ? (
            <a
              href={
                selected.lat != null && selected.lng != null
                  ? googleMapPlaceUrl(selected.lat, selected.lng)
                  : selected.google_maps_url && /^https?:\/\//i.test(selected.google_maps_url)
                    ? selected.google_maps_url
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selected.fallbackQuery ?? selected.name)}`
              }
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:border-blue-400"
            >
              <MapPin className="h-4 w-4 text-[color:var(--brand-primary)]" />
              Open {selected.name} in Google Maps
            </a>
          ) : null}
        </div>
      </div>
    </section>
  );
}

