import "server-only";

import { createClient } from "@supabase/supabase-js";

declare global {
  var __supabaseAdmin: ReturnType<typeof createClient> | undefined;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "http://127.0.0.1:54321";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "missing-supabase-service-role-key";

export const hasSupabaseAdminEnv = Boolean(
  (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) && process.env.SUPABASE_SERVICE_ROLE_KEY
);

function makeClient() {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
export const supabaseAdmin = global.__supabaseAdmin ?? (global.__supabaseAdmin = makeClient());
