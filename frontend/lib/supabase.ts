import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient as createBrowserSupabaseClient } from "@/lib/supabase/client";

/**
 * Browser-only lazy singleton (back-compat). Prefer `import { createClient } from '@/lib/supabase/client'`.
 * Server: `import { createClient } from '@/lib/supabase/server'` or `@/lib/supabaseAdmin` for service role.
 */
const globalForSb = globalThis as unknown as { __salonBrowserSupabase?: SupabaseClient };

function getBrowserClient(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("Do not use @/lib/supabase on the server. Use @/lib/supabase/server or @/lib/supabaseAdmin.");
  }
  if (!globalForSb.__salonBrowserSupabase) {
    globalForSb.__salonBrowserSupabase = createBrowserSupabaseClient();
  }
  return globalForSb.__salonBrowserSupabase;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    return Reflect.get(getBrowserClient(), prop, receiver);
  },
  set(_target, prop, value, receiver) {
    return Reflect.set(getBrowserClient(), prop, value, receiver);
  },
});

export { createClient } from "@/lib/supabase/client";
