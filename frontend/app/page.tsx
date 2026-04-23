import { headers } from "next/headers";
import Link from "next/link";
import { Calendar, Search, Sparkles } from "lucide-react";
import { FeaturedShopsSection } from "@/components/marketing/featured-shops-section";
import { PublicHeader } from "@/components/public-header";

const directApiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:4000/api";

async function fetchBackendJson(): Promise<{
  ok: boolean;
  message?: string;
  error?: string;
  via?: string;
}> {
  const pathsToTry: { url: string; via: string }[] = [];

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

  pathsToTry.push({
    url: `${directApiBase}/test`,
    via: "direct URL (NEXT_PUBLIC_API_URL)",
  });

  let lastError = "Unknown error";

  for (const { url, via } of pathsToTry) {
    try {
      const res = await fetch(url, { cache: "no-store" });
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
  const status = await fetchBackendJson();

  return (
    <div className="min-h-screen bg-[#f6f2ea] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <PublicHeader showMarketingNav />

      <main>
        <section
          className="relative overflow-hidden border-b border-amber-200/60 bg-gradient-to-br from-amber-50 via-[#f6f2ea] to-zinc-100 dark:border-zinc-800 dark:from-zinc-900 dark:via-zinc-950 dark:to-zinc-900"
          aria-labelledby="hero-heading"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-300/40 blur-3xl dark:bg-amber-500/10"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-800/80 dark:text-amber-200/90">
              Barbershop · Beard · Grooming
            </p>
            <h1
              id="hero-heading"
              className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-white"
            >
              Sharp cuts. Clean fades. Premium barbershop experience.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
              Trusted neighborhood barbers, modern techniques, and classic service.
              Book your chair in seconds and walk out fresh every time.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/shops"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-amber-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Find a barbershop
              </Link>
              <a
                href="#services"
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white/60 px-6 py-3 text-sm font-semibold text-zinc-800 backdrop-blur hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:border-zinc-500"
              >
                Explore services
              </a>
            </div>
          </div>
        </section>

        <FeaturedShopsSection />

        <section
          className="border-y border-amber-200/80 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/20"
          aria-labelledby="how-heading"
        >
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
            <h2
              id="how-heading"
              className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white"
            >
              How it works
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
              Book in minutes — pick a verified shop, choose your service and stylist, then show up on time.
            </p>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                {
                  step: "1",
                  title: "Browse & compare",
                  text: "Search barbershops by name or area and compare services, barbers, and reviews.",
                  Icon: Search,
                },
                {
                  step: "2",
                  title: "Book a slot",
                  text: "Select a service, optional stylist, and a time that fits your calendar.",
                  Icon: Calendar,
                },
                {
                  step: "3",
                  title: "Enjoy your visit",
                  text: "Get reminders, join the live queue if you walk in, and earn loyalty points.",
                  Icon: Sparkles,
                },
              ].map(({ step, title, text, Icon }) => (
                <li
                  key={step}
                  className="rounded-2xl border border-amber-200/80 bg-[#f6f2ea] p-6 dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-100">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-amber-800/90 dark:text-amber-200/90">
                    Step {step}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{text}</p>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/shops"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-amber-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Shops
              </Link>
              <Link
                href="/app/auth?tab=login"
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-800 hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
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
              className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white"
            >
              What we do
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              From everyday cuts to full transformations, we focus on healthy hair and
              results that fit your life.
            </p>
          </div>
          <ul className="mt-10 grid gap-6 sm:grid-cols-2">
            {services.map((s) => (
              <li
                key={s.title}
                className="rounded-2xl border border-amber-200/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                  {s.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  {s.blurb}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section
          id="visit"
          className="border-y border-amber-200/80 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/30"
        >
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:grid-cols-2 sm:px-6 sm:py-20">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white">
                Visit us
              </h2>
              <p className="mt-3 text-zinc-600 dark:text-zinc-400">
                128 Oak Street, Suite 4
                <br />
                Portland, OR 97209
              </p>
              <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-500">
                Street parking and a small lot behind the building.
              </p>
            </div>
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-amber-800/90 dark:text-amber-200/90">
                Hours
              </h3>
              <dl className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <div className="flex justify-between gap-8 border-b border-amber-100 pb-2 dark:border-zinc-800">
                  <dt>Mon – Fri</dt>
                  <dd>9:00 – 19:00</dd>
                </div>
                <div className="flex justify-between gap-8 border-b border-amber-100 pb-2 dark:border-zinc-800">
                  <dt>Saturday</dt>
                  <dd>9:00 – 17:00</dd>
                </div>
                <div className="flex justify-between gap-8">
                  <dt>Sunday</dt>
                  <dd>Closed</dd>
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
              className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-white"
            >
              Account &amp; platform
            </h2>
            <p className="mt-2 text-zinc-600 dark:text-zinc-400">
              Sign in and manage sessions on the web app (same flows power a future mobile
              app via the API).
            </p>
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2">
            {[
              "Login with mobile number and password — no email required",
              "Password reset: OTP sent by SMS to registered mobile (SMS gateway in production)",
              "JWT access tokens (7-day default) and rotating refresh tokens",
              "Staff portal on this site: header “Staff login” or path /app",
              "Optional: dedicated login host app.yourdomain.com via env",
            ].map((text) => (
              <li
                key={text}
                  className="flex gap-3 rounded-xl border border-amber-200/80 bg-white p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300"
              >
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500/80"
                  aria-hidden
                />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/platform"
              className="inline-flex items-center justify-center rounded-full bg-amber-700 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-amber-800 dark:bg-amber-200 dark:text-zinc-900 dark:hover:bg-white"
            >
              View all platform pages
            </Link>
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-amber-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Open account &amp; staff demo
            </Link>
            <Link
              href="/book"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white/60 px-6 py-3 text-sm font-semibold text-zinc-800 backdrop-blur hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-100"
            >
              Book an appointment
            </Link>
          </div>
        </section>

        <section
          id="book"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="book-heading"
        >
          <div className="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 px-8 py-12 text-center shadow-lg dark:from-amber-950 dark:to-zinc-950 sm:px-12">
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
                className="inline-flex w-full max-w-xs items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-amber-50 sm:w-auto"
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

      <footer className="border-t border-amber-200/80 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              © {new Date().getFullYear()} Prime Barbershop. All rights reserved.
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
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                    BACKEND_URL
                  </code>{" "}
                  /{" "}
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">
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
