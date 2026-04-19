import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingFlow } from "../booking-flow";
import type { PublicShopDetailPayload } from "@/lib/salon-api";
import { serverFetchJson } from "@/lib/server-api";

type Props = { params: Promise<{ shopId: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { shopId } = await props.params;
  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${shopId}`);
  const name = raw?.data?.shop?.name;
  return {
    title: name ? `Book — ${name}` : `Book — ${shopId}`,
    description: "Choose service, barber, and time.",
  };
}

export default async function BookByShopPage(props: Props) {
  const { shopId } = await props.params;
  const id = Number.parseInt(shopId, 10);
  if (Number.isNaN(id)) notFound();

  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${id}`);
  if (!raw?.data) notFound();

  const { shop } = raw.data;

  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-rose-100/80 bg-[#faf8f6]/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-800/80 dark:text-rose-200/80">
              Online booking
            </p>
            <h1 className="font-semibold tracking-tight text-zinc-900 dark:text-white">
              Book with <span className="text-rose-800 dark:text-rose-200">{shop.name}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href={`/shops/${shop.id}`}
              className="text-sm font-medium text-rose-800 hover:underline dark:text-rose-200"
            >
              Shop
            </Link>
            <Link href="/" className="text-sm font-medium text-rose-800 hover:underline dark:text-rose-200">
              Home
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <BookingFlow shopSlug={shop.slug} />
      </main>
    </div>
  );
}
