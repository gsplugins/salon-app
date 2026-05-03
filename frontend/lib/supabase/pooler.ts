/**
 * Direct PostgreSQL connection pooling (port 6543 + `pgbouncer=true`) is **not** used by
 * `@supabase/supabase-js` or `@supabase/ssr` — they use the HTTPS PostgREST API.
 *
 * Set `DATABASE_URL` or `SUPABASE_DB_POOLER_URL` only if you add Prisma/Drizzle/`pg`
 * alongside this app. Example:
 * `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true`
 */
export const SUPABASE_JS_USES_HTTPS_NOT_PORT_6543 = true as const;
