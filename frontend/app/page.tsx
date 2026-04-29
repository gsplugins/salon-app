export const revalidate = 300;

import { headers } from "next/headers";
import Link from "next/link";
import { Calendar, Search, Sparkles } from "lucide-react";
import { FeaturedShopsSection } from "@/components/marketing/featured-shops-section";
import { HomeShopsMapSection } from "@/components/marketing/home-shops-map-section";
import { PublicHeader } from "@/components/public-header";
import { serverFetchJson } from "@/lib/server-api";
import type { Paginated, PublicShopListRow } from "@/lib/salon-api";

function normalizeApiBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (!trimmed) return "http://127.0.0.1:4000/api";
  try {
    const parsed = new URL(trimmed);
    if (parsed.pathname === "" || parsed.pathname === "/") {
      parsed.pathname = "/api";
    } else if (!parsed.pathname.endsWith("/api")) {
      parsed.pathname = `${parsed.pathname.replace(/\/$/, "")}/api`;
    }
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  }
}

const directApiBase = normalizeApiBase(
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000/api"
);

async function fetchBackendJson(): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
  via?: string;
}> {
  // Avoid extra runtime API probe on production requests.
  if (process.env.NODE_ENV === "production") {
    return { ok: true, message: "Operational", via: "production cached mode" };
  }
  const pathsToTry: { url: string; via: string }[] = [];

  // Only try headers during runtime, not build time
  const isBuildTime = process.env.NEXT_PHASE === 'phase-production-build';
  
  if (!isBuildTime) {
    try {
      const h = await headers();
      const host = h.get("x-forwarded-host") ?? h.get("host");
      const proto = h.get("x-forwarded-proto") ?? "http";
      if (host) {
        pathsToTry.push({
          url: `${proto}://${host}/api/test`,
          via: "same-origin proxy (Next → API)",
        });
      }
    } catch {
      // headers() unavailable (e.g. static context) — rely on direct URL only
    }
  }

  pathsToTry.push({
    url: `${directApiBase}/test`,
    via: "direct URL (NEXT_PUBLIC_API_URL)",
  });

  let lastError = "Unknown error";

  for (const { url, via } of pathsToTry) {
    try {
      const res = await fetch(url, { next: { revalidate: 60 } });
      if (!res.ok) {
        lastError = `HTTP ${res.status} (${via})`;
        continue;
      }
      const data = (await res.json()) as { message?: string };
      return { ok: true, message: data.message, via };
    } catch (e) {
      lastError =
        e instanceof Error ? `${e.message} (${via})` : `Request failed (${via})`;
    }
  }

  return { ok: false, error: lastError };
}

const services = [
  {
    title: "Skin fades & classic cuts",
    blurb: "Sharp fades, modern styles, and clean everyday cuts tailored to your look.",
  },
  {
    title: "Beard trim & line-up",
    blurb: "Precision beard shaping, clean neckline, and detailed line-ups for a polished finish.",
  },
  {
    title: "Hot towel shave",
    blurb: "Traditional close shave with hot towel prep and soothing aftercare.",
  },
  {
    title: "Wash & grooming care",
    blurb: "Scalp refresh and grooming care so you leave looking sharp and feeling fresh.",
  },
];

export default async function Home() {
  const [status, shopsRaw] = await Promise.all([
    fetchBackendJson(),
    serverFetchJson<Paginated<PublicShopListRow>>("/public/shops?per_page=60"),
  ]);
  const mapShops = (shopsRaw?.data ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    latitude: s.latitude ?? null,
    longitude: s.longitude ?? null,
    address: s.address ?? null,
    google_maps_url: s.google_maps_url ?? null,
    city: s.city ?? null,
    district: s.district ?? null,
  }));

  return (
    <div className="min-h-screen text-[color:var(--foreground)]">
      <PublicHeader showMarketingNav />

      <main>
        <section
          className="relative overflow-hidden border-b border-[color:var(--border)] bg-[color:var(--background)]"
          aria-labelledby="hero-heading"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#c8a96e]/20 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-[color:var(--brand-primary)]">
              Barbershop · Beard · Grooming
            </p>
            <h1
              id="hero-heading"
              className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-[color:var(--foreground)] sm:text-5xl"
            >
              Discover nearby barbershops and book instantly.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-[color:var(--paragraph)]">
              Compare registered local shops, see services and team profiles, then reserve your best time slot in minutes.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/shops"
                className="inline-flex items-center justify-center rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-400"
              >
                Find a barbershop
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 text-sm font-semibold text-[color:var(--foreground)] backdrop-blur hover:border-blue-400"
              >
                How booking works
              </a>
            </div>
          </div>
        </section>

        <FeaturedShopsSection shops={shopsRaw?.data ?? []} />
        <HomeShopsMapSection shops={mapShops} />

        <section
          className="border-y border-[color:var(--border)] bg-[color:var(--surface-elevated)]"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2
              id="how-heading"
              className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]"
            >
              How it works
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-[color:var(--paragraph)]">
              Search by area, pick a trusted barber shop, and confirm your booking with your phone number.
            </p>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Browse & compare",
                  text: "Find shops near your location and compare ratings, team and services.",
                  Icon: Search,
                },
                {
                  step: "2",
                  title: "Book a slot",
                  text: "Choose services, your preferred barber, and a suitable date/time.",
                  Icon: Calendar,
                },
                {
                  step: "3",
                  title: "Enjoy your visit",
                  text: "Receive booking updates and optionally join live queue for walk-in visits.",
                  Icon: Sparkles,
                },
              ].map(({ step, title, text, Icon }) => (
                <li
                  key={step}
                  className="card-clean p-6"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[color:color-mix(in srgb, var(--brand-primary) 16%, transparent)] text-[color:var(--brand-primary)]">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-[color:var(--caption)]">
                    Step {step}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-[color:var(--foreground)]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[color:var(--paragraph)]">{text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/shops"
                className="inline-flex items-center justify-center rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-400"
              >
                Shops
              </Link>
              <Link
                href="/app/auth?tab=login"
                className="inline-flex items-center justify-center rounded-full border border-[color:var(--border)] bg-[color:var(--surface)] px-6 py-3 text-sm font-semibold text-[color:var(--foreground)] hover:border-blue-400"
              >
                Customer sign-in
              </Link>
            </div>
          </div>
        </section>

        <section
          id="services"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="services-heading"
        >
          <div className="max-w-2xl">
            <h2
              id="services-heading"
              className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]"
            >
              Popular barbershop services
            </h2>
            <p className="mt-2 text-[color:var(--paragraph)]">
              Services and pricing are shown per shop, so you can compare before booking.
            </p>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {services.map((s) => (
              <li
                key={s.title}
                className="card-clean p-6"
              >
                <h3 className="text-lg font-semibold text-[color:var(--foreground)]">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[color:var(--paragraph)]">
                  {s.blurb}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="visit"
          className="border-y border-[color:var(--border)] bg-[color:var(--surface-elevated)]"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 sm:py-20">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]">
                Find shops near you
              </h2>
              <p className="mt-3 text-[color:var(--paragraph)]">
                Use the shop directory with division, district, and city filters.
                <br />
                Pick your nearest location and book directly.
              </p>
              <p className="mt-4 text-sm text-[color:var(--caption)]">
                Each shop page includes address, map, services, team, and customer reviews.
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)] p-5 shadow-sm">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-[color:var(--brand-primary)]">
                Quick start
              </h3>
              <dl className="mt-3 space-y-2 text-sm text-[color:var(--paragraph)]">
                <div className="flex justify-between gap-8 border-b border-[color:var(--border)] pb-2">
                  <dt>Step 1</dt>
                  <dd>Search nearest shop</dd>
                </div>
                <div className="flex justify-between gap-8 border-b border-[color:var(--border)] pb-2">
                  <dt>Step 2</dt>
                  <dd>Select service + barber</dd>
                </div>
                <div className="flex justify-between gap-8">
                  <dt>Step 3</dt>
                  <dd>Confirm booking</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section
          id="account"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20"
          aria-labelledby="account-heading"
        >
          <div className="max-w-2xl">
            <h2
              id="account-heading"
              className="text-2xl font-semibold tracking-tight text-[color:var(--foreground)]"
            >
              Why people book here
            </h2>
            <p className="mt-2 text-slate-300">
              Built for real customer behavior: discover local shops quickly and book with confidence.
            </p>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Only registered barber shops are listed publicly",
              "See real service menus before booking",
              "Check barber profile and customer reviews",
              "Join live walk-in queue when needed",
              "Booking confirmation and reminder-ready workflow",
            ].map((text) => (
              <li
                key={text}
                  className="card-clean flex gap-3 p-4 text-sm leading-relaxed text-slate-300"
              >
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-blue-400"
                  aria-hidden
                />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/shops"
              className="inline-flex items-center justify-center rounded-full bg-blue-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-400"
            >
              Browse all shops
            </Link>
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-200 backdrop-blur hover:border-blue-400"
            >
              Start booking now
            </Link>
          </div>
        </section>

        <section
          id="book"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="book-heading"
        >
          <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-[#111111] to-[#1a1a1a] px-8 py-12 text-center shadow-lg sm:px-12">
            <h2
              id="book-heading"
              className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              Ready for your next appointment?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-300">
              Book online in a few steps, or call or message us if you prefer. We will confirm details and
              anything we should know before you arrive.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/book"
                className="inline-flex w-full max-w-xs items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-800 hover:bg-amber-50 sm:w-auto"
              >
                Book online
              </Link>
              <a
                href="tel:+15035550128"
                className="inline-flex w-full max-w-xs items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                (503) 555-0128
              </a>
              <a
                href="mailto:hello@lumieresalon.example"
                className="inline-flex w-full max-w-xs items-center justify-center rounded-full border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10 sm:w-auto"
              >
                hello@lumieresalon.example
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[color:var(--border)] bg-[color:var(--surface-elevated)]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[color:var(--paragraph)]">
              © {new Date().getFullYear()} BarbarShop. All rights reserved.
            </p>
            <div
              className={`rounded-xl border px-3 py-2 text-xs ${
                status.ok
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                  : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
              }`}
              role="status"
              aria-live="polite"
            >
              {status.ok ? (
                <span>
                  API: connected
                  {status.message ? ` — ${status.message}` : ""}
                  {status.via ? ` (${status.via})` : ""}
                </span>
              ) : (
                <span title={status.error}>
                  API: offline — start the API (`backend-supabase`) or check{" "}
                  <code className="rounded bg-[color:var(--surface)] px-1">
                    BACKEND_URL
                  </code>{" "}
                  /{" "}
                  <code className="rounded bg-[color:var(--surface)] px-1">
                    NEXT_PUBLIC_API_URL
                  </code>
                </span>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}