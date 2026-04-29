import Link from "next/link";
import { MapPin, Star } from "lucide-react";
import type { PublicShopListRow } from "@/lib/salon-api";

export function FeaturedShopsSection({ shops }: { shops: PublicShopListRow[] }) {
  const rows = shops.slice(0, 6);

  if (rows.length === 0) {
    return (
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="featured-heading">
        <h2 id="featured-heading" className="text-2xl font-semibold text-[color:var(--foreground)]">
          Featured barbershops
        </h2>
        <p className="mt-2 text-sm text-[color:var(--paragraph)]">
          No public shops yet — check back soon or ask your salon to go live on the platform.
        </p>
      </section>
    );
  }

  return (
    <section
      className="mx-auto max-w-6xl px-4 py-14 sm:px-6"
      aria-labelledby="featured-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="featured-heading" className="text-2xl font-semibold text-[color:var(--foreground)]">
            Popular nearby shops
          </h2>
          <p className="mt-1 text-sm text-[color:var(--paragraph)]">
            Real registered barbershops with open booking slots.
          </p>
        </div>
        <Link
          href="/shops"
          className="text-sm font-semibold text-[color:var(--brand-primary)] hover:underline"
        >
          View all shops
        </Link>
      </div>
      <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((s) => (
          <li key={s.id}>
            <Link
              href={`/shops/${s.id}`}
              className="card-clean flex h-full flex-col p-5 transition hover:border-blue-400"
            >
              <h3 className="text-lg font-semibold text-[color:var(--foreground)]">{s.name}</h3>
              {s.address ? (
                <p className="mt-2 flex items-start gap-2 text-sm text-[color:var(--paragraph)]">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-primary)]" />
                  <span>{s.address}</span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-[color:var(--caption)]">Online booking available</p>
              )}
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-[color:var(--brand-primary)]">
                <Star className="h-4 w-4" aria-hidden />
                View &amp; book
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
