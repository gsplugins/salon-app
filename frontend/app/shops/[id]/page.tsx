import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin, Phone, Star } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import type { PublicShopDetailPayload } from "@/lib/salon-api";
import { serverFetchJson } from "@/lib/server-api";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${id}`);
  const name = raw?.data?.shop?.name;
  return {
    title: name ? `${name} — Salon` : `Shop ${id}`,
    description: "Services, team, reviews, and booking.",
  };
}

export default async function ShopDetailPage(props: Props) {
  const { id } = await props.params;
  const shopId = Number.parseInt(id, 10);
  if (Number.isNaN(shopId)) notFound();

  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${shopId}`);
  if (!raw?.data) notFound();

  const { shop, services, staff, reviews_summary, reviews } = raw.data;
  const photos = Array.isArray(shop.photos) ? shop.photos.filter((p): p is string => typeof p === "string") : [];

  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-white">{shop.name}</h1>
            {shop.description ? (
              <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{shop.description}</p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              {shop.address ? (
                <span className="inline-flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-rose-700 dark:text-rose-300" />
                  {shop.address}
                </span>
              ) : null}
              {shop.phone ? (
                <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-2 hover:text-rose-800 dark:hover:text-rose-200">
                  <Phone className="h-4 w-4" />
                  {shop.phone}
                </a>
              ) : null}
            </div>

            {photos.length > 0 ? (
              <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {photos.slice(0, 6).map((src) => (
                  // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                  <img
                    key={src}
                    src={src}
                    alt=""
                    className="aspect-[4/3] w-full rounded-xl object-cover bg-zinc-200 dark:bg-zinc-800"
                  />
                ))}
              </div>
            ) : null}

            <section className="mt-12" aria-labelledby="svc">
              <h2 id="svc" className="text-xl font-semibold text-zinc-900 dark:text-white">
                Services
              </h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {services.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium text-zinc-900 dark:text-white">{s.name}</span>
                      {s.price_cents != null ? (
                        <span className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                          {(s.price_cents / 100).toFixed(0)} {/** assume major units */}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      {s.duration_minutes} min
                      {s.category ? ` · ${s.category}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-12" aria-labelledby="team">
              <h2 id="team" className="text-xl font-semibold text-zinc-900 dark:text-white">
                Team
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {staff.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/barbers/${b.id}`}
                      className="flex gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition hover:border-rose-200 dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-600"
                    >
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100">
                        {b.name.slice(0, 1)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-zinc-900 dark:text-white">{b.name}</p>
                        {b.bio ? (
                          <p className="mt-1 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{b.bio}</p>
                        ) : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="mt-12" aria-labelledby="reviews">
              <h2 id="reviews" className="text-xl font-semibold text-zinc-900 dark:text-white">
                Reviews
              </h2>
              {reviews.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No reviews yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {reviews.map((r) => (
                    <li
                      key={r.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                        <Star className="h-4 w-4 fill-current" />
                        <span className="text-sm font-medium">{r.rating}/5</span>
                        {r.staff_name ? (
                          <span className="text-xs text-zinc-500">with {r.staff_name}</span>
                        ) : null}
                      </div>
                      {r.comment ? (
                        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{r.comment}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-2 text-amber-500">
                <Star className="h-5 w-5 fill-current" />
                <span className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {reviews_summary.avg_rating != null ? reviews_summary.avg_rating.toFixed(1) : "—"}
                </span>
                <span className="text-sm text-zinc-500">({reviews_summary.count})</span>
              </div>
              <Link
                href={`/book/${shop.id}`}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-rose-100 dark:text-zinc-900"
              >
                <Calendar className="h-4 w-4" />
                Book now
              </Link>
              <Link
                href={`/queue/${shop.id}`}
                className="mt-3 flex w-full items-center justify-center rounded-xl border border-zinc-200 py-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
              >
                Live queue
              </Link>
              <p className="mt-4 text-xs text-zinc-500">
                Or book with slug:{" "}
                <Link href={`/s/${shop.slug}/book`} className="font-medium text-rose-800 underline dark:text-rose-200">
                  /s/{shop.slug}/book
                </Link>
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
