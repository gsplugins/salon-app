import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Phone, Scissors, Star, UserRound } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import type { PublicBarberProfilePayload } from "@/lib/salon-api";
import { serverFetchJson } from "@/lib/server-api";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { id } = await props.params;
  const raw = await serverFetchJson<{ data: PublicBarberProfilePayload }>(`/public/barbers/${id}`);
  const name = raw?.data?.name;
  return { title: name ? `${name} — Stylist` : `Barber ${id}` };
}

export default async function BarberProfilePage(props: Props) {
  const { id } = await props.params;
  const staffId = Number.parseInt(id, 10);
  if (Number.isNaN(staffId)) notFound();

  const raw = await serverFetchJson<{ data: PublicBarberProfilePayload }>(`/public/barbers/${staffId}`);
  if (!raw?.data) notFound();

  const d = raw.data;
  const specialties = Array.isArray(d.specialties) ? d.specialties.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
  const services = Array.isArray(d.services) ? d.services : [];
  const completedBookings = d.stats?.completed_bookings ?? 0;

  return (
    <div className="min-h-screen text-slate-100">
      <PublicHeader />
      <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <div className="section-wrap p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-slate-800 text-3xl font-semibold text-slate-100">
              {d.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photo_url} alt="" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                d.name.slice(0, 1)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-white">{d.name}</h1>
              <Link
                href={`/shops/${d.shop.id}`}
                className="mt-1 text-sm font-medium text-blue-300 hover:underline"
              >
                {d.shop.name}
              </Link>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {d.position_title ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
                    <UserRound className="h-3.5 w-3.5" />
                    {d.position_title}
                  </span>
                ) : null}
                {d.staff_role ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {d.staff_role}
                  </span>
                ) : null}
                {typeof d.experience_years === "number" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1">
                    {d.experience_years}+ years exp.
                  </span>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-2 text-blue-300">
                <Star className="h-5 w-5 fill-current" />
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {d.reviews_summary.avg_rating != null ? d.reviews_summary.avg_rating.toFixed(1) : "—"}
                </span>
                <span className="text-sm text-zinc-500">({d.reviews_summary.count} reviews)</span>
              </div>
              {d.bio ? <p className="mt-4 text-sm leading-relaxed text-slate-300">{d.bio}</p> : null}
              <div className="mt-4 grid gap-2 text-sm text-slate-300">
                {d.work_mobile ? (
                  <a href={`tel:${d.work_mobile}`} className="inline-flex items-center gap-2 hover:text-rose-700 dark:hover:text-rose-200">
                    <Phone className="h-4 w-4" />
                    {d.work_mobile}
                  </a>
                ) : null}
                {d.address ? (
                  <p className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    {d.address}
                  </p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="card-clean p-4">
              <p className="text-xs text-slate-400">Completed bookings</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{completedBookings}</p>
            </div>
            <div className="card-clean p-4">
              <p className="text-xs text-slate-400">Services offered</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{services.length}</p>
            </div>
            <div className="card-clean p-4">
              <p className="text-xs text-slate-400">Specialties</p>
              <p className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-white">{specialties.length}</p>
            </div>
          </div>

          {specialties.length > 0 ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">Specialties</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {specialties.map((item) => (
                  <span key={item} className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200">
                    {item}
                  </span>
                ))}
              </div>
            </section>
          ) : null}

          {services.length > 0 ? (
            <section className="mt-8">
              <h2 className="inline-flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-white">
                <Scissors className="h-4 w-4" />
                Services by this staff
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {services.map((service) => (
                  <li key={service.id} className="card-clean p-3">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">{service.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {service.duration_minutes} min
                      {service.price_cents != null ? ` · ${(service.price_cents / 100).toFixed(0)}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/book/${d.shop.id}`} className="rounded-full bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-400">
              Book at this shop
            </Link>
            <Link
              href={`/s/${d.shop.slug}/book`}
              className="rounded-full border border-blue-300/40 px-5 py-2.5 text-sm font-medium text-blue-100"
            >
              Open legacy book URL
            </Link>
          </div>
        </div>

        {d.recent_reviews.length > 0 ? (
          <section className="mt-10" aria-labelledby="recent-rev">
            <h2 id="recent-rev" className="text-lg font-semibold text-zinc-900 dark:text-white">
              Recent reviews
            </h2>
            <ul className="mt-4 space-y-3">
              {d.recent_reviews.map((r) => (
                <li
                  key={r.id}
                  className="card-clean p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-800 text-xs font-semibold text-slate-100">
                      {r.customer_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element -- remote URLs from API
                        <img src={r.customer_photo_url} alt={r.customer_name ?? "Customer"} className="h-full w-full object-cover" />
                      ) : (
                        (r.customer_name ?? "C").slice(0, 1).toUpperCase()
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">{r.customer_name ?? "Customer"}</p>
                      {r.created_at ? <p className="text-[11px] text-slate-400">{new Date(r.created_at).toLocaleDateString()}</p> : null}
                    </div>
                  </div>
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{r.rating}/5</p>
                  {r.comment ? (
                    <p className="mt-1 text-sm text-slate-300">{r.comment}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
