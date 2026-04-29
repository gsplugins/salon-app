import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, Clock3, MapPin, Phone, Scissors, Star, Truck } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import type { PublicShopDetailPayload } from "@/lib/salon-api";
import { serverFetchJson } from "@/lib/server-api";

type Props = { params: Promise<{ id: string }> };

function money(cents: number | null): string {
  if (cents == null) return "Price on request";
  return `৳${Math.round(cents / 100)}`;
}

function stars(rating: number): string {
  const n = Math.max(1, Math.min(5, Math.round(rating)));
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${id}`);
  const name = raw?.data?.shop?.name;
  return {
    title: name ? `${name} - Shop` : `Shop ${id}`,
    description: "Public salon page with services, staff, reviews, and booking.",
  };
}

export default async function ShopDetailPage(props: Props) {
  const { id } = await props.params;
  const shopId = Number.parseInt(id, 10);
  if (Number.isNaN(shopId)) notFound();

  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${shopId}`);
  if (!raw?.data) notFound();

  const { shop, services, staff, booking_stats, reviews_summary, reviews } = raw.data;
  const stats = booking_stats ?? { pending: 0, confirmed: 0, cancelled: 0, completed: 0, total_customers: 0 };
  const locationLabel = [shop.area, shop.city, shop.district, shop.division].filter(Boolean).join(", ");
  const photos = Array.isArray(shop.photos) ? shop.photos.filter((x): x is string => typeof x === "string" && x.trim() !== "") : [];
  const reviewsPreview = reviews.slice(0, 6);
  const servicePreview = services.slice(0, 6);
  const staffPreview = staff.slice(0, 6);
  const paymentMethods = Array.isArray(shop.payment_methods) ? shop.payment_methods.filter(Boolean) : [];
  const weeklyHolidays = Array.isArray(shop.weekly_holidays) ? shop.weekly_holidays.filter(Boolean) : [];
  const categories = Array.isArray(shop.categories) ? shop.categories.filter(Boolean) : [];
  const socialProfiles = Array.isArray(shop.social_profiles) ? shop.social_profiles : [];

  return (
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <PublicHeader />
      <main className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6">
        <section className="section-wrap overflow-hidden">
          <div className="border-b border-[color:var(--border)] bg-[radial-gradient(circle_at_70%_0%,rgba(179,92,111,0.14)_0%,rgba(255,246,248,0)_55%),linear-gradient(135deg,#fff6f8_0%,#fff1f4_100%)] p-8 sm:p-10">
            <p className="text-xs uppercase tracking-[0.24em] text-[color:var(--caption)]">Public profile</p>
            <h1 className="mt-4 text-3xl font-semibold sm:text-4xl">
              Where beauty meets <span className="text-[color:var(--brand-primary)]">elegance</span>
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-[color:var(--paragraph)]">
              {shop.description ?? "Modern cuts, beard grooming, and polished style by a trained barber team."}
            </p>
            {categories.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span
                    key={c}
                    className="rounded-full border border-[color:color-mix(in srgb, var(--brand-primary) 40%, transparent)] bg-[color:color-mix(in srgb, var(--brand-primary) 8%, transparent)] px-2.5 py-1 text-[11px] uppercase tracking-wide text-[color:var(--brand-primary)]"
                  >
                    {c}
                  </span>
                ))}
              </div>
            ) : shop.category ? <p className="mt-2 text-xs uppercase tracking-wide text-[#C8973A]">{shop.category}</p> : null}
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm text-[color:var(--paragraph)]">
              {locationLabel ? <span>{locationLabel}</span> : null}
              {shop.phone ? (
                <a href={`tel:${shop.phone}`} className="inline-flex items-center gap-1.5 hover:text-[color:var(--brand-primary)]">
                  <Phone className="h-4 w-4" />
                  {shop.phone}
                </a>
              ) : null}
              {shop.whatsapp_phone ? (
                <a
                  href={`https://wa.me/${shop.whatsapp_phone.replace(/[^\d]/g, "")}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 hover:text-[color:var(--brand-primary)]"
                >
                  WhatsApp: {shop.whatsapp_phone}
                </a>
              ) : null}
              <Link href={`/queue/${shop.id}`} className="inline-flex items-center gap-1.5 hover:text-[color:var(--brand-primary)]">
                <Clock3 className="h-4 w-4" />
                Live queue
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-[color:var(--border)] bg-[color:var(--surface-elevated)] sm:grid-cols-4">
            <div className="border-r border-[color:var(--border)] p-4 text-center">
              <p className="text-xl font-semibold text-[color:var(--brand-primary)]">{servicePreview.length}</p>
              <p className="text-xs text-[color:var(--caption)]">Top services</p>
            </div>
            <div className="border-r border-[color:var(--border)] p-4 text-center">
              <p className="text-xl font-semibold text-[color:var(--brand-primary)]">{staff.length}</p>
              <p className="text-xs text-[color:var(--caption)]">Master barbers</p>
            </div>
            <div className="border-r border-[color:var(--border)] p-4 text-center">
              <p className="text-xl font-semibold text-[color:var(--brand-primary)]">{stats.completed}</p>
              <p className="text-xs text-[color:var(--caption)]">Completed jobs</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xl font-semibold text-[color:var(--brand-primary)]">
                {reviews_summary.avg_rating != null ? reviews_summary.avg_rating.toFixed(1) : "-"}
              </p>
              <p className="text-xs text-[color:var(--caption)]">Rating</p>
            </div>
          </div>

          {photos.length > 0 ? (
            <div className="grid gap-3 p-5 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={src} src={src} alt={shop.name} className="h-44 w-full rounded-xl object-cover" />
              ))}
            </div>
          ) : null}
        </section>

        <section className="mt-8 section-wrap p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--caption)]">Shop details</p>
          <h2 className="mt-2 text-2xl text-blue-300 font-semibold">Business and contact info</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shop.email ? (
              <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3 text-sm">
                Email: {shop.email}
              </p>
            ) : null}
            {shop.website ? (
              <a
                href={shop.website}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3 text-sm hover:text-[color:var(--brand-primary)]"
              >
                Website
              </a>
            ) : null}
            {shop.google_maps_url ? (
              <a
                href={shop.google_maps_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3 text-sm hover:text-[color:var(--brand-primary)]"
              >
                Google Maps
              </a>
            ) : null}
            {shop.established_year ? (
              <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3 text-sm">
                Established: {shop.established_year}
              </p>
            ) : null}
            <p className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3 text-sm">
              <Truck className="h-4 w-4 text-[color:var(--brand-primary)]" />
              Delivery: {shop.delivery_available ? "Available" : "Not available"}
            </p>
            {paymentMethods.length ? (
              <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3 text-sm">
                Payments: {paymentMethods.join(", ")}
              </p>
            ) : null}
            {weeklyHolidays.length ? (
              <p className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-elevated)] p-3 text-sm sm:col-span-2 lg:col-span-3">
                Weekly holidays: {weeklyHolidays.join(", ")}
              </p>
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {socialProfiles.length
              ? socialProfiles.map((s) => (
                  <a
                    key={`${s.platform}-${s.url}`}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2 hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
                  >
                    {s.platform}
                  </a>
                ))
              : null}
          </div>
        </section>

        <section className="mt-8 section-wrap p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Shop services</p>
          <h2 className="mt-2 text-2xl text-blue-300 font-semibold">Crafted for every style</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {servicePreview.map((s) => (
              <article key={s.id} className="rounded-xl border border-zinc-700 bg-[radial-gradient(circle_at_70%_0%,rgba(179,92,111,0.14)_0%,rgba(255,246,248,0)_55%),linear-gradient(135deg,#fff6f8_0%,#fff1f4_100%)] p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{s.name}</p>
                  <span className="text-sm text-[#C8973A]">{money(s.price_cents)}</span>
                </div>
                <p className="mt-1 text-xs text-zinc-300">{s.duration_minutes} min{s.category ? ` - ${s.category}` : ""}</p>
                {s.description ? <p className="mt-2 text-xs text-zinc-400">{s.description}</p> : null}
              </article>
            ))}
            {services.length === 0 ? <p className="text-sm text-zinc-400">No services published yet.</p> : null}
          </div>
          {services.length > servicePreview.length ? (
            <p className="mt-3 text-xs text-zinc-400">+ {services.length - servicePreview.length} more services available on booking.</p>
          ) : null}
        </section>

        <section className="mt-8 section-wrap p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Meet the team</p>
          <h2 className="mt-2 text-2xl text-blue-300 font-semibold">Master barbers</h2>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {staffPreview.map((member) => (
              <Link
                key={member.id}
                href={`/barbers/${member.id}`}
                className="rounded-xl border border-zinc-700 bg-[radial-gradient(circle_at_70%_0%,rgba(179,92,111,0.14)_0%,rgba(255,246,248,0)_55%),linear-gradient(135deg,#fff6f8_0%,#fff1f4_100%)] p-4 transition hover:border-[#C8973A]"
              >
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white border border-zinc-700 text-sm font-semibold">
                  {member.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={member.photo_url} alt={member.name} className="h-full w-full object-cover" />
                  ) : (
                    member.name.slice(0, 1).toUpperCase()
                  )}
                </div>
                <p className="mt-3 font-medium">{member.name}</p>
                <p className="mt-1 text-xs text-zinc-400">{member.bio ? member.bio.slice(0, 46) : "Senior barber"}</p>
                <p className="mt-2 text-xs text-[#C8973A]">View profile</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="mt-8 section-wrap p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Reviews</p>
          <h2 className="mt-2 text-2xl text-blue-300 font-semibold">What clients say</h2>
          {reviewsPreview.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No reviews yet.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reviewsPreview.map((r) => (
                <article key={r.id} className="rounded-xl border border-zinc-700 bg-[#2c2c2c] p-4">
                  <p className="text-xs text-[#C8973A]">{stars(r.rating)}</p>
                  {r.comment ? <p className="mt-2 text-sm text-zinc-200">{r.comment}</p> : null}
                  <p className="mt-3 text-xs text-zinc-400">
                    {r.customer_name ?? "Customer"}
                    {r.staff_name ? ` - with ${r.staff_name}` : ""}
                  </p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 section-wrap p-6">
          <h2 className="text-2xl text-blue-300 font-semibold">Book your appointment</h2>
          <p className="mt-2 text-sm text-zinc-300">Pick services, barber preference, and preferred time in minutes.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-700 bg-[#f5f0e8] px-3 py-2 text-sm text-zinc-700">Your name</div>
            <div className="rounded-lg border border-zinc-700 bg-[#f5f0e8] px-3 py-2 text-sm text-zinc-700">Phone number</div>
            <div className="rounded-lg border border-zinc-700 bg-[#f5f0e8] px-3 py-2 text-sm text-zinc-700">Select service</div>
            <div className="rounded-lg border border-zinc-700 bg-[#f5f0e8] px-3 py-2 text-sm text-zinc-700">Preferred date</div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href={`/book/${shop.id}`} className="inline-flex items-center gap-2 rounded-full bg-[#C8973A] px-5 py-2.5 text-sm font-semibold text-[#1a1a1a] hover:bg-[#b9872d]">
              <Calendar className="h-4 w-4" />
              Open booking flow
            </Link>
            <Link href={`/s/${shop.slug}/book`} className="inline-flex items-center gap-2 rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold hover:border-[#C8973A] hover:text-[#C8973A]">
              Legacy booking URL
            </Link>
            {shop.address ? (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address)}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold hover:border-[#C8973A] hover:text-[#C8973A]"
              >
                <MapPin className="h-4 w-4" />
                Open map
              </a>
            ) : null}
          </div>
          <div className="mt-4 grid gap-2 text-xs text-zinc-400 sm:grid-cols-3">
            <p className="inline-flex items-center gap-1.5"><Scissors className="h-3.5 w-3.5" /> Pending: {stats.pending}</p>
            <p className="inline-flex items-center gap-1.5"><Star className="h-3.5 w-3.5" /> Confirmed: {stats.confirmed}</p>
            <p>Total customers served: {stats.total_customers}</p>
          </div>
        </section>
      </main>
    </div>
  );
}
