import { headers } from "next/headers";
import Link from "next/link";

const staffLoginHref =
  process.env.NEXT_PUBLIC_STAFF_LOGIN_URL?.replace(/\/$/, "") ?? "/app";
const staffLoginIsExternal =
  staffLoginHref.startsWith("http://") || staffLoginHref.startsWith("https://");

const directApiBase =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ??
  "http://127.0.0.1:8000/api";

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
        via: "same-origin proxy (Next → Laravel)",
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
    title: "Cut & style",
    blurb: "Precision cuts, blowouts, and finishes tailored to your hair and routine.",
  },
  {
    title: "Color & gloss",
    blurb: "Balayage, highlights, and glossing for depth, shine, and healthy-looking color.",
  },
  {
    title: "Treatments",
    blurb: "Deep conditioning and repair so your hair feels as good as it looks.",
  },
  {
    title: "Special occasions",
    blurb: "Bridal and event styling — polished looks that last through the celebration.",
  },
];

export default async function Home() {
  const status = await fetchBackendJson();

  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <header className="sticky top-0 z-20 border-b border-rose-100/80 bg-[#faf8f6]/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="#" className="font-semibold tracking-tight text-zinc-900 dark:text-white">
            Lumière Salon
          </a>
          <nav
            className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2 text-sm font-medium text-zinc-600 dark:text-zinc-300"
            aria-label="Primary"
          >
            <a href="#services" className="hover:text-rose-700 dark:hover:text-rose-300">
              Services
            </a>
            <a href="#visit" className="hover:text-rose-700 dark:hover:text-rose-300">
              Visit
            </a>
            <a href="#account" className="hover:text-rose-700 dark:hover:text-rose-300">
              Account
            </a>
            {staffLoginIsExternal ? (
              <a
                href={staffLoginHref}
                className="hover:text-rose-700 dark:hover:text-rose-300"
              >
                Staff login
              </a>
            ) : (
              <Link
                href={staffLoginHref}
                className="hover:text-rose-700 dark:hover:text-rose-300"
              >
                Staff login
              </Link>
            )}
            <a
              href="#book"
              className="rounded-full bg-zinc-900 px-4 py-2 text-white hover:bg-zinc-800 dark:bg-rose-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Book
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section
          className="relative overflow-hidden border-b border-rose-100/60 bg-gradient-to-br from-rose-50 via-[#faf8f6] to-amber-50/80 dark:border-zinc-800 dark:from-rose-950/40 dark:via-zinc-950 dark:to-zinc-900"
          aria-labelledby="hero-heading"
        >
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-rose-200/40 blur-3xl dark:bg-rose-500/10"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pb-28 sm:pt-24">
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-rose-800/80 dark:text-rose-200/90">
              Hair · Color · Care
            </p>
            <h1
              id="hero-heading"
              className="mt-4 max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-zinc-900 sm:text-5xl dark:text-white"
            >
              Look and feel your best — every visit.
            </h1>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-300">
              Warm, skilled stylists, thoughtful consultation, and a calm space designed
              around you. Book your next appointment and leave with hair you love.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <a
                href="#book"
                className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-rose-100 dark:text-zinc-900 dark:hover:bg-white"
              >
                Schedule an appointment
              </a>
              <a
                href="#services"
                className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white/60 px-6 py-3 text-sm font-semibold text-zinc-800 backdrop-blur hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-100 dark:hover:border-zinc-500"
              >
                Explore services
              </a>
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
                className="rounded-2xl border border-rose-100/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50"
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
          className="border-y border-rose-100/80 bg-white/70 dark:border-zinc-800 dark:bg-zinc-900/30"
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
              <h3 className="text-sm font-semibold uppercase tracking-wider text-rose-800/90 dark:text-rose-200/90">
                Hours
              </h3>
              <dl className="mt-3 space-y-2 text-sm text-zinc-700 dark:text-zinc-300">
                <div className="flex justify-between gap-8 border-b border-rose-50 pb-2 dark:border-zinc-800">
                  <dt>Mon – Fri</dt>
                  <dd>9:00 – 19:00</dd>
                </div>
                <div className="flex justify-between gap-8 border-b border-rose-50 pb-2 dark:border-zinc-800">
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
                className="flex gap-3 rounded-xl border border-rose-100/80 bg-white p-4 text-sm leading-relaxed text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-300"
              >
                <span
                  className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-rose-500/80"
                  aria-hidden
                />
                {text}
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/app"
              className="inline-flex items-center justify-center rounded-full bg-zinc-900 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-zinc-800 dark:bg-rose-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              Open account &amp; staff demo
            </Link>
            <a
              href="#book"
              className="inline-flex items-center justify-center rounded-full border border-zinc-300 bg-white/60 px-6 py-3 text-sm font-semibold text-zinc-800 backdrop-blur hover:border-zinc-400 dark:border-zinc-600 dark:bg-zinc-900/60 dark:text-zinc-100"
            >
              Book an appointment
            </a>
          </div>
        </section>

        <section
          id="book"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 sm:px-6 sm:py-24"
          aria-labelledby="book-heading"
        >
          <div className="rounded-3xl bg-gradient-to-br from-zinc-900 to-zinc-800 px-8 py-12 text-center shadow-lg dark:from-rose-950 dark:to-zinc-950 sm:px-12">
            <h2
              id="book-heading"
              className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            >
              Ready for your next appointment?
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-zinc-300">
              Call or message us to find a time that works. We will confirm details and
              anything we should know before you arrive.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <a
                href="tel:+15035550128"
                className="inline-flex w-full max-w-xs items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-zinc-900 hover:bg-rose-50 sm:w-auto"
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

      <footer className="border-t border-rose-100/80 bg-white/80 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              © {new Date().getFullYear()} Lumière Salon. All rights reserved.
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
                  API: offline — start Laravel or check{" "}
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
