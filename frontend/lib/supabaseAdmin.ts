import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

declare global {
  var __supabaseAdmin: SupabaseClient | undefined;
}

/**
 * Server-side project URL (HTTPS). Prefer `SUPABASE_URL` so secrets stay off `NEXT_PUBLIC_*`.
 * `@supabase/supabase-js` talks to PostgREST over HTTPS, not Postgres :6543.
 * For direct Postgres (Prisma, Drizzle, `pg`), use a pooler DSN separately, e.g.
 * `postgresql://...@...pooler.supabase.com:6543/postgres?pgbouncer=true`.
 */
const supabaseUrl =
  process.env.SUPABASE_URL?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
  "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "missing-supabase-service-role-key";

export const hasSupabaseAdminEnv = Boolean(
  (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeClient(): SupabaseClient {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

/** One shared admin client per server runtime (important for warm serverless reuse). */
export const supabaseAdmin = global.__supabaseAdmin ?? (global.__supabaseAdmin = makeClient());
