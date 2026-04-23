import type { PostgrestError } from "@supabase/supabase-js";

/** Human-readable PostgREST / Postgres error for API responses and logs. */
export function formatPostgrestError(err: PostgrestError | null | undefined): string {
  if (!err) return "Unknown database error";
  const parts = [err.message, err.hint, err.details].filter(Boolean);
  return parts.length ? parts.join(" — ") : "Unknown database error";
}

/** PostgREST when `public.users` (or similar) was never created — schema not applied. */
export function hintMissingPublicTables(err: PostgrestError | null | undefined): string | null {
  if (!err?.message) return null;
  const m = err.message.toLowerCase();
  if (!m.includes("schema cache") && !m.includes("could not find the table")) return null;
  return (
    "Database tables are missing. In Supabase: SQL Editor → paste and run `backend-supabase/supabase/schema.sql` " +
    "(or from `backend-supabase/` run `npx supabase link --project-ref <ref>` then `npm run db:push`). " +
    "Then run `supabase/seed.sql` if you need the demo super admin."
  );
}
