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
    <div className="min-h-screen bg-[color:var(--background)] text-[color:var(--foreground)]">
      <header className="border-b border-[color:var(--border)] bg-[color:color-mix(in srgb, var(--background) 92%, transparent)] backdrop-blur-md">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-[color:var(--brand-primary)]">
              Online booking
            </p>
            <h1 className="font-semibold tracking-tight text-[color:var(--foreground)]">
              Book with <span className="text-[color:var(--brand-primary)]">{slug}</span>
            </h1>
          </div>
          <Link
            href="/"
            className="shrink-0 text-sm font-medium text-[color:var(--brand-primary)] hover:underline"
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
