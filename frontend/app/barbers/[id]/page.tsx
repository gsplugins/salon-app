import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Star } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-3xl font-semibold text-rose-900 dark:bg-rose-950 dark:text-rose-100">
              {d.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photo_url} alt="" className="h-full w-full rounded-2xl object-cover" />
              ) : (
                d.name.slice(0, 1)
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">{d.name}</h1>
              <Link
                href={`/shops/${d.shop.id}`}
                className="mt-1 text-sm font-medium text-rose-800 hover:underline dark:text-rose-200"
              >
                {d.shop.name}
              </Link>
              <div className="mt-3 flex items-center gap-2 text-amber-500">
                <Star className="h-5 w-5 fill-current" />
                <span className="font-semibold text-zinc-900 dark:text-white">
                  {d.reviews_summary.avg_rating != null ? d.reviews_summary.avg_rating.toFixed(1) : "—"}
                </span>
                <span className="text-sm text-zinc-500">({d.reviews_summary.count} reviews)</span>
              </div>
              {d.bio ? <p className="mt-4 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{d.bio}</p> : null}
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href={`/book/${d.shop.id}`}
              className="rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
            >
              Book at this shop
            </Link>
            <Link
              href={`/s/${d.shop.slug}/book`}
              className="rounded-full border border-zinc-200 px-5 py-2.5 text-sm font-medium dark:border-zinc-600"
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
                  className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                >
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">{r.rating}/5</p>
                  {r.comment ? (
                    <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">{r.comment}</p>
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
