import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clock3, MapPin, Phone, Star, Tag, Users } from "lucide-react";
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
    description: "Shop profile, services, barbers, customer reviews, and instant booking.",
  };
}

export default async function ShopDetailPage(props: Props) {
  const { id } = await props.params;
  const shopId = Number.parseInt(id, 10);
  if (Number.isNaN(shopId)) notFound();

  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${shopId}`);
  if (!raw?.data) notFound();

  const { shop, services, staff, booking_stats, reviews_summary, reviews, offers = [] } = raw.data;
  const photos = Array.isArray(shop.photos) ? shop.photos.filter((p): p is string => typeof p === "string") : [];
  const hasCoords = Boolean(shop.latitude && shop.longitude);
  const mapsQuery = hasCoords
    ? `${shop.latitude},${shop.longitude}`
    : shop.address
      ? encodeURIComponent(shop.address)
      : "";
  const mapsHref = mapsQuery ? `https://www.google.com/maps/search/?api=1&query=${mapsQuery}` : null;
  const locationLabel = [shop.city, shop.district, shop.division].filter(Boolean).join(", ");
  const featuredPhoto = photos[0] ?? null;
  const serviceCount = services.length;
  const staffCount = staff.length;
  const topServices = services.slice(0, 8);
  const stats = booking_stats ?? { pending: 0, confirmed: 0, cancelled: 0, completed: 0, total_customers: 0 };

  return (
    <div className="min-h-screen text-slate-100">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="section-wrap overflow-hidden">
          {featuredPhoto ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
            <img src={featuredPhoto} alt="" className="h-52 w-full object-cover sm:h-64" />
          ) : (
            <div className="h-40 w-full bg-gradient-to-r from-slate-900 to-slate-800" />
          )}
          <div className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3">
                  {shop.logo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                    <img src={shop.logo_url} alt={`${shop.name} logo`} className="h-14 w-14 rounded-full border border-zinc-200 object-cover dark:border-zinc-700" />
                  ) : null}
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-white">{shop.name}</h1>
                    {locationLabel ? <p className="text-sm text-slate-300">{locationLabel}</p> : null}
                  </div>
                </div>
                {shop.description ? <p className="mt-4 max-w-3xl text-sm text-slate-300">{shop.description}</p> : null}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="card-clean px-3 py-2">
                  <p className="font-semibold text-white">{serviceCount}</p>
                  <p className="text-slate-400">Services</p>
                </div>
                <div className="card-clean px-3 py-2">
                  <p className="font-semibold text-white">{staffCount}</p>
                  <p className="text-slate-400">Staff</p>
                </div>
                <div className="card-clean px-3 py-2">
                  <p className="font-semibold text-white">
                    {reviews_summary.avg_rating != null ? reviews_summary.avg_rating.toFixed(1) : "—"}
                  </p>
                  <p className="text-slate-400">Rating</p>
                </div>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/book/${shop.id}`} className="inline-flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-400">
                <Calendar className="h-4 w-4" />
                Book now
              </Link>
              <Link href={`/queue/${shop.id}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">
                <Clock3 className="h-4 w-4" />
                Live queue
              </Link>
              {mapsHref ? (
                <a href={mapsHref} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-200">
                  <MapPin className="h-4 w-4" />
                  Open map
                </a>
              ) : null}
            </div>
          </div>
        </section>

        {photos.length > 1 ? (
          <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Shop gallery</h2>
              <p className="text-xs text-zinc-500">Swipe horizontally</p>
            </div>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
              {photos.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                <img
                  key={src}
                  src={src}
                  alt=""
                  className="h-44 w-72 snap-start rounded-xl object-cover bg-zinc-200 dark:bg-zinc-800"
                />
              ))}
            </div>
          </section>
        ) : null}

        {offers.length > 0 ? (
          <section className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Featured offers</h2>
              <p className="text-xs text-zinc-500">Limited-time deals</p>
            </div>
            <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
              {offers.map((offer, idx) => (
                <article
                  key={`${offer.title}-${idx}`}
                  className="w-72 shrink-0 snap-start rounded-xl border border-rose-200 bg-gradient-to-br from-rose-50 to-orange-50 p-4 dark:border-rose-900 dark:from-rose-950/40 dark:to-orange-950/30"
                >
                  <p className="inline-flex items-center gap-2 text-sm font-semibold text-rose-900 dark:text-rose-100">
                    <Tag className="h-4 w-4" />
                    {offer.title}
                  </p>
                  {offer.discount_text ? (
                    <p className="mt-1 text-sm font-medium text-rose-800 dark:text-rose-200">{offer.discount_text}</p>
                  ) : null}
                  {offer.description ? (
                    <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-300">{offer.description}</p>
                  ) : null}
                  {offer.valid_until ? (
                    <p className="mt-2 text-[11px] text-zinc-500">Valid until {offer.valid_until}</p>
                  ) : null}
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Today at this shop</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                  <p className="text-xs text-amber-700 dark:text-amber-200">Pending</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-900 dark:text-amber-100">{stats.pending}</p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30">
                  <p className="text-xs text-sky-700 dark:text-sky-200">Confirmed</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-900 dark:text-sky-100">{stats.confirmed}</p>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                  <p className="text-xs text-rose-700 dark:text-rose-200">Cancelled</p>
                  <p className="mt-1 text-2xl font-semibold text-rose-900 dark:text-rose-100">{stats.cancelled}</p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                  <p className="text-xs text-emerald-700 dark:text-emerald-200">Completed</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-900 dark:text-emerald-100">{stats.completed}</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-800/60">
                  <p className="text-xs text-zinc-600 dark:text-zinc-300">Total customers</p>
                  <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">{stats.total_customers}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Most booked services</h2>
                <p className="text-xs text-zinc-500">Compare options before booking</p>
              </div>
              <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2">
                {topServices.map((s) => (
                  <div key={s.id} className="w-56 shrink-0 snap-start rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
                    <p className="font-medium text-zinc-900 dark:text-white">{s.name}</p>
                    <p className="mt-1 text-xs text-zinc-500">{s.duration_minutes} min{s.category ? ` · ${s.category}` : ""}</p>
                    {s.price_cents != null ? (
                      <p className="mt-2 text-sm font-semibold text-rose-700 dark:text-rose-200">{(s.price_cents / 100).toFixed(0)}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Location & map</h2>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-300">
                {shop.address ? <p className="inline-flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4" />{shop.address}</p> : null}
                {shop.phone ? <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-2 hover:text-rose-700"><Phone className="h-4 w-4" />{shop.phone}</a> : null}
              </div>
              {mapsHref ? (
                <div className="mt-4 overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
                  <iframe
                    title={`${shop.name} location`}
                    src={`https://www.google.com/maps?q=${mapsQuery}&output=embed`}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    className="h-72 w-full border-0"
                  />
                </div>
              ) : (
                <p className="mt-3 text-sm text-zinc-500">Map location not available yet.</p>
              )}
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Service menu</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {services.map((s) => (
                  <li key={s.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-zinc-900 dark:text-white">{s.name}</p>
                      {s.price_cents != null ? <p className="text-sm font-semibold text-rose-700 dark:text-rose-200">{(s.price_cents / 100).toFixed(0)}</p> : null}
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">{s.duration_minutes} min{s.category ? ` · ${s.category}` : ""}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Barber team</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {staff.map((b) => (
                  <li key={b.id}>
                    <Link href={`/barbers/${b.id}`} className="flex gap-3 rounded-xl border border-zinc-200 p-4 transition hover:border-rose-200 dark:border-zinc-700 dark:hover:border-zinc-500">
                      <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100">
                        {b.photo_url ? (
                          // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                          <img src={b.photo_url} alt={b.name} className="h-full w-full object-cover" />
                        ) : (
                          b.name.slice(0, 1)
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-zinc-900 dark:text-white">{b.name}</p>
                        {b.bio ? <p className="line-clamp-2 text-sm text-zinc-600 dark:text-zinc-300">{b.bio}</p> : null}
                        <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-200">View staff profile</p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>

            <section className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Recent customer reviews</h2>
              {reviews.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No reviews yet.</p>
              ) : (
                <div className="mt-4 grid grid-flow-col auto-cols-[minmax(260px,1fr)] gap-3 overflow-x-auto pb-2">
                  {reviews.map((r) => (
                    <article key={r.id} className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                            {r.customer_photo_url ? (
                              // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                              <img src={r.customer_photo_url} alt={r.customer_name ?? "Customer"} className="h-full w-full object-cover" />
                            ) : (
                              (r.customer_name ?? "C").slice(0, 1).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-zinc-900 dark:text-white">{r.customer_name ?? "Customer"}</p>
                            {r.created_at ? <p className="text-[11px] text-zinc-500">{new Date(r.created_at).toLocaleDateString()}</p> : null}
                          </div>
                        </div>
                      </div>
                      <p className="inline-flex items-center gap-2 text-sm font-medium text-amber-600 dark:text-amber-300">
                        <Star className="h-4 w-4 fill-current" />
                        {r.rating}/5
                        {r.staff_name ? <span className="text-xs text-zinc-500">with {r.staff_name}</span> : null}
                      </p>
                      {r.comment ? <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{r.comment}</p> : null}
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-5 lg:col-span-1">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">All offers</h3>
              {offers.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No active offers right now.</p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {offers.map((offer, idx) => (
                    <li key={`${offer.title}-${idx}`} className="rounded-xl border border-rose-200 bg-rose-50 p-3 dark:border-rose-900 dark:bg-rose-950/30">
                      <p className="inline-flex items-center gap-2 text-sm font-semibold text-rose-900 dark:text-rose-100">
                        <Tag className="h-4 w-4" />
                        {offer.title}
                      </p>
                      {offer.discount_text ? <p className="mt-1 text-xs font-medium text-rose-800 dark:text-rose-200">{offer.discount_text}</p> : null}
                      {offer.description ? <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{offer.description}</p> : null}
                      {offer.valid_until ? <p className="mt-1 text-[11px] text-zinc-500">Valid until: {offer.valid_until}</p> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <Users className="h-4 w-4" />
                {staffCount} barbers available
              </p>
              <p className="mt-2 inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
                <Star className="h-4 w-4 text-amber-500" />
                {reviews_summary.avg_rating != null ? `${reviews_summary.avg_rating.toFixed(1)} average rating` : "No ratings yet"}
              </p>
              <p className="mt-3 text-xs text-zinc-500">
                Direct booking link:{" "}
                <Link href={`/s/${shop.slug}/book`} className="font-medium text-rose-700 underline dark:text-rose-200">
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
