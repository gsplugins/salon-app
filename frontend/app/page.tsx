import { headers } from "next/headers";

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

export default async function Home() {
  const status = await fetchBackendJson();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-100 px-6 py-16 font-sans dark:bg-zinc-950">
      <main className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Salon app
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          API requests go through Next rewrites to{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
            {process.env.BACKEND_URL ?? "http://127.0.0.1:8000"}
          </code>
          , with a fallback to{" "}
          <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">
            {directApiBase}
          </code>
          .
        </p>

        <div
          className={`mt-6 rounded-xl border px-4 py-3 text-sm ${
            status.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
          }`}
        >
          {status.ok ? (
            <>
              <p className="font-medium">Backend connected</p>
              {status.message && (
                <p className="mt-1 opacity-90">{status.message}</p>
              )}
              {status.via && (
                <p className="mt-2 text-xs opacity-75">Route: {status.via}</p>
              )}
            </>
          ) : (
            <>
              <p className="font-medium">Backend not reachable</p>
              <p className="mt-1 opacity-90">{status.error}</p>
              <ul className="mt-3 list-inside list-disc space-y-1 text-xs opacity-90">
                <li>
                  Start Laravel:{" "}
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                    cd backend &amp;&amp; php artisan serve
                  </code>{" "}
                  (default{" "}
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                    127.0.0.1:8000
                  </code>
                  ), or use Laragon and set{" "}
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                    BACKEND_URL
                  </code>{" "}
                  in <code className="rounded bg-black/5 px-1 dark:bg-white/10">.env.local</code>{" "}
                  to your site URL (no trailing slash).
                </li>
                <li>
                  Match{" "}
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                    NEXT_PUBLIC_API_URL
                  </code>{" "}
                  to{" "}
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                    BACKEND_URL + /api
                  </code>
                  , then restart{" "}
                  <code className="rounded bg-black/5 px-1 dark:bg-white/10">
                    npm run dev
                  </code>{" "}
                  (rewrites are read at startup).
                </li>
              </ul>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
