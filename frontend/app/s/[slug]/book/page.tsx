import Link from "next/link";
import { BookingFlow } from "../../../book/booking-flow";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return {
    title: `Book — ${slug}`,
    description: "Choose a service, stylist, date and time, then confirm with your name and phone.",
  };
}

export default async function ShopBookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="border-b border-rose-100/80 bg-[#faf8f6]/90 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-rose-800/80 dark:text-rose-200/80">
              Online booking
            </p>
            <h1 className="font-semibold tracking-tight text-zinc-900 dark:text-white">
              Book with <span className="text-rose-800 dark:text-rose-200">{slug}</span>
            </h1>
          </div>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-rose-800 hover:underline dark:text-rose-200"
          >
            Home
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <BookingFlow shopSlug={slug} />
      </main>
    </div>
  );
}
