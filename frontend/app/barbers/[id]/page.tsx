import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Calendar, MapPin, Phone, Scissors, Star } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import type { PublicBarberProfilePayload } from "@/lib/salon-api";
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
  const raw = await serverFetchJson<{ data: PublicBarberProfilePayload }>(`/public/barbers/${id}`);
  const name = raw?.data?.name;
  return { title: name ? `${name} - Barber profile` : `Barber ${id}` };
}

export default async function BarberProfilePage(props: Props) {
  const { id } = await props.params;
  const staffId = Number.parseInt(id, 10);
  if (Number.isNaN(staffId)) notFound();

  const raw = await serverFetchJson<{ data: PublicBarberProfilePayload }>(`/public/barbers/${staffId}`);
  if (!raw?.data) notFound();

  const d = raw.data;
  const services = Array.isArray(d.services) ? d.services : [];
  const gallery = Array.isArray(d.photo_gallery_urls) ? d.photo_gallery_urls.filter((v) => typeof v === "string" && v.trim() !== "") : [];
  const specialties = Array.isArray(d.specialties) ? d.specialties.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
  const reviews = d.recent_reviews.slice(0, 6);
  const completed = d.stats?.completed_bookings ?? 0;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicHeader />
      <main className="mx-auto max-w-5xl px-4 pb-14 pt-8 sm:px-6">
        <section className="section-wrap overflow-hidden">
          <div className="border-b border-zinc-800 bg-[linear-gradient(140deg,#1a1a1a_0%,#2c2c2c_100%)] p-8 sm:p-10">
            <p className="text-xs uppercase tracking-[0.22em] text-zinc-400">Barber profile</p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-[#4A4A4A] text-lg font-semibold">
                {d.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.photo_url} alt={d.name} className="h-full w-full object-cover" />
                ) : (
                  d.name.slice(0, 1).toUpperCase()
                )}
              </div>
              <div>
                <h1 className="text-3xl font-semibold">
                  {d.name} <span className="text-[#C8973A]">.</span>
                </h1>
                <Link href={`/shops/${d.shop.id}`} className="text-sm text-zinc-300 hover:text-[#C8973A]">
                  {d.shop.name}
                </Link>
              </div>
            </div>
            <p className="mt-4 max-w-2xl text-sm text-zinc-300">{d.bio ?? "Experienced barber focused on precision cuts and confident styling."}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              {d.position_title ? <span className="rounded-full border border-zinc-700 bg-[#2c2c2c] px-2.5 py-1">{d.position_title}</span> : null}
              {d.staff_role ? <span className="rounded-full border border-zinc-700 bg-[#2c2c2c] px-2.5 py-1">{d.staff_role}</span> : null}
              {typeof d.experience_years === "number" ? (
                <span className="rounded-full border border-zinc-700 bg-[#2c2c2c] px-2.5 py-1">{d.experience_years}+ years experience</span>
              ) : null}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-zinc-300">
              <span className="inline-flex items-center gap-1.5">
                <Star className="h-4 w-4 text-[#C8973A]" />
                {d.reviews_summary.avg_rating != null ? d.reviews_summary.avg_rating.toFixed(1) : "-"} ({d.reviews_summary.count})
              </span>
              {d.work_mobile ? (
                <a href={`tel:${d.work_mobile}`} className="inline-flex items-center gap-1.5 hover:text-[#C8973A]">
                  <Phone className="h-4 w-4" />
                  {d.work_mobile}
                </a>
              ) : null}
              {d.address ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" />
                  {d.address}
                </span>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 border-b border-zinc-800 bg-[#1f1f1f] sm:grid-cols-4">
            <div className="border-r border-zinc-800 p-4 text-center">
              <p className="text-xl font-semibold text-[#C8973A]">{completed}</p>
              <p className="text-xs text-zinc-400">Completed jobs</p>
            </div>
            <div className="border-r border-zinc-800 p-4 text-center">
              <p className="text-xl font-semibold text-[#C8973A]">{services.length}</p>
              <p className="text-xs text-zinc-400">Services</p>
            </div>
            <div className="border-r border-zinc-800 p-4 text-center">
              <p className="text-xl font-semibold text-[#C8973A]">{specialties.length}</p>
              <p className="text-xs text-zinc-400">Specialties</p>
            </div>
            <div className="p-4 text-center">
              <p className="text-xl font-semibold text-[#C8973A]">{d.reviews_summary.count}</p>
              <p className="text-xs text-zinc-400">Reviews</p>
            </div>
          </div>

          {gallery.length > 0 ? (
            <div className="grid gap-3 p-5 sm:grid-cols-3">
              {gallery.slice(0, 3).map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={`${src}-${i}`} src={src} alt={`${d.name} work ${i + 1}`} className="h-44 w-full rounded-xl object-cover" />
              ))}
            </div>
          ) : null}
        </section>

        {specialties.length > 0 ? (
          <section className="mt-8 section-wrap p-5">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Strengths</p>
            <h2 className="mt-2 text-2xl font-semibold">Signature specialties</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {specialties.map((item) => (
                <span key={item} className="rounded-full border border-zinc-700 bg-[#2c2c2c] px-3 py-1 text-xs">
                  {item}
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 section-wrap p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Service menu</p>
          <h2 className="mt-2 inline-flex items-center gap-2 text-2xl font-semibold">
            <Scissors className="h-5 w-5" />
            Services by this barber
          </h2>
          {services.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No public services yet.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <article key={service.id} className="rounded-xl border border-zinc-700 bg-[#2c2c2c] p-4">
                  <p className="font-medium">{service.name}</p>
                  <p className="mt-1 text-xs text-zinc-300">{service.duration_minutes} min</p>
                  <p className="mt-2 text-sm text-[#C8973A]">{money(service.price_cents)}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 section-wrap p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-zinc-400">Client feedback</p>
          <h2 className="mt-2 text-2xl font-semibold">What clients say</h2>
          {reviews.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-400">No reviews yet.</p>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {reviews.map((r) => (
                <article key={r.id} className="rounded-xl border border-zinc-700 bg-[#2c2c2c] p-4">
                  <p className="text-xs text-[#C8973A]">{stars(r.rating)}</p>
                  {r.comment ? <p className="mt-2 text-sm text-zinc-200">{r.comment}</p> : null}
                  <p className="mt-3 text-xs text-zinc-400">{r.customer_name ?? "Customer"}</p>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="mt-8 section-wrap p-6">
          <h2 className="text-2xl font-semibold">Book with this barber</h2>
          <p className="mt-2 text-sm text-zinc-300">Continue to booking and select services, then choose this staff member.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href={`/book/${d.shop.id}?staff_id=${d.id}`}
              className="inline-flex items-center gap-2 rounded-full bg-[#C8973A] px-5 py-2.5 text-sm font-semibold text-[#1a1a1a] hover:bg-[#b9872d]"
            >
              <Calendar className="h-4 w-4" />
              Book now
            </Link>
            <Link
              href={`/s/${d.shop.slug}/book?staff_id=${d.id}`}
              className="inline-flex items-center gap-2 rounded-full border border-zinc-600 px-5 py-2.5 text-sm font-semibold hover:border-[#C8973A] hover:text-[#C8973A]"
            >
              Open direct booking URL
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
