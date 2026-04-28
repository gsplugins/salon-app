function readSupabaseUrl(): string {
  return (
    process.env.SUPABASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    ""
  );
}

function required(key: "SUPABASE_SERVICE_ROLE_KEY" | "JWT_SECRET"): string {
  const value = process.env[key]?.trim();
  return value || `missing-${key.toLowerCase()}`;
}

function assertSupabaseEnvNotPlaceholder(url: string, serviceRoleKey: string): void {
  const rawKey = serviceRoleKey.trim();
  if (/^sb_publishable_/i.test(rawKey)) {
    throw new Error(
        `SUPABASE_SERVICE_ROLE_KEY must be the "service_role" secret from Supabase (Dashboard → Project Settings → API).\n` +
        `You set the publishable key (sb_publishable_…). That is for the browser only; the Node API needs "service_role".\n` +
        `Reveal and copy "service_role" into SUPABASE_SERVICE_ROLE_KEY in frontend/.env.local`
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(`SUPABASE_URL is not a valid URL: ${url.trim().slice(0, 80)}`);
  }
  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith(".supabase.co")) {
    throw new Error(`SUPABASE_URL must use a *.supabase.co host (got: ${parsed.hostname})`);
  }

  const u = url.toLowerCase();
  const k = rawKey.toLowerCase();
  const badHostBits = ["your_project_ref", "replace_with", "changeme", "placeholder", "xxxxxxxx"];
  const badUrl = badHostBits.some((f) => host.includes(f) || u.includes(f)) || u.includes("example.supabase");
  const badKey =
    k.includes("your_service_role") ||
    k.includes("replace_with") ||
    k.includes("service_role_key_here") ||
    k.includes("changeme");

  if (badUrl || badKey) {
    const keyLen = serviceRoleKey.trim().length;
    const hints: string[] = [];
    if (badUrl) {
      hints.push(
        `SUPABASE_URL: use the exact "Project URL" from Supabase → Project Settings → API (e.g. https://abcdefghijklmnop.supabase.co).`
      );
    }
    if (badKey) {
      hints.push(
        `SUPABASE_SERVICE_ROLE_KEY: paste the full "service_role" secret from that same page (usually 200+ characters, starts with eyJ).`
      );
    }
    if (keyLen > 0 && keyLen < 120) {
      hints.push(`(Your service_role value is only ${keyLen} characters — a real key is much longer.)`);
    }
    throw new Error(
      `Supabase env still contains placeholder text — the API cannot start until you fix it.\n\n` +
        hints.join("\n\n") +
        `\n\nWhat was read from disk:\n` +
        `  hostname: ${host}\n` +
        `  service_role key length: ${keyLen} chars\n` +
        `\nSet env vars in frontend/.env.local and restart the Next.js server.`
    );
  }
}

const _supabaseUrl = readSupabaseUrl();
const safeSupabaseUrl = _supabaseUrl || "http://127.0.0.1:54321";
const _serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
if (_supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  assertSupabaseEnvNotPlaceholder(_supabaseUrl, _serviceRole);
}
export const hasApiSupabaseEnv = Boolean(_supabaseUrl && process.env.SUPABASE_SERVICE_ROLE_KEY);

export const config = {
  port: Number(process.env.PORT ?? 3000),
  supabaseUrl: safeSupabaseUrl,
  supabaseServiceRoleKey: _serviceRole,
  jwtSecret: required("JWT_SECRET"),
  jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 604800),
  jwtRefreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000)
};

