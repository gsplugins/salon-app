import type { PostgrestError } from "@supabase/supabase-js";

/** Human-readable PostgREST / Postgres error for API responses and logs. */
export function formatPostgrestError(err: PostgrestError | null | undefined): string {
  if (!err) return "Unknown database error";
  const parts = [err.message, err.hint, err.details].filter(Boolean);
  return parts.length ? parts.join(" — ") : "Unknown database error";
}

function errorBlob(err: PostgrestError | null | undefined): string {
  if (!err) return "";
  const parts: string[] = [err.message, err.details, err.hint].filter((x): x is string => Boolean(x));
  const cause = (err as { cause?: { message?: string; code?: string; name?: string } }).cause;
  if (cause && typeof cause === "object") {
    for (const x of [cause.message, cause.code, cause.name]) {
      if (x) parts.push(x);
    }
  }
  return parts.join(" ").toLowerCase();
}

/** DNS / TLS / firewall — host in SUPABASE_URL does not resolve or is unreachable. */
export function hintSupabaseUnreachable(err: PostgrestError | null | undefined): string | null {
  const t = errorBlob(err);
  if (!t.trim()) return null;
  const network =
    t.includes("fetch failed") ||
    t.includes("enotfound") ||
    t.includes("getaddrinfo") ||
    t.includes("econnrefused") ||
    t.includes("etimedout") ||
    t.includes("enetunreach") ||
    t.includes("certificate") ||
    t.includes("ssl");
  if (!network) return null;
  return (
    "Cannot reach Supabase from this server. Set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) in frontend/.env.local (or Vercel env) to the exact " +
    '"Project URL" (Dashboard → Project Settings → API), for example https://abcdefghijk.supabase.co — no typo in the subdomain. ' +
    "If DNS still fails: confirm the project exists and is not deleted, unpause a paused project, or try another network/VPN/DNS. " +
    "On Windows: nslookup your-project-ref.supabase.co"
  );
}

/** PostgREST when `public.users` (or similar) was never created — schema not applied. */
export function hintMissingPublicTables(err: PostgrestError | null | undefined): string | null {
  if (!err?.message) return null;
  const m = err.message.toLowerCase();
  if (!m.includes("schema cache") && !m.includes("could not find the table")) return null;
  return (
    "Database tables are missing. In Supabase SQL Editor, run your schema/migrations for this project, then seed demo data if needed."
  );
}

