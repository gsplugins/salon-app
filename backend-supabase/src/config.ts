import dotenv from "dotenv";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** backend-supabase/ (contains package.json and .env) — stable even if `npm run dev` uses another cwd */
const packageRoot = path.resolve(__dirname, "..");

const envPrimary = path.join(packageRoot, ".env");
const envLocal = path.join(packageRoot, ".env.local");

dotenv.config({ path: envPrimary });
dotenv.config({ path: envLocal });

/** `.env` sometimes uses Next-style `NEXT_PUBLIC_SUPABASE_URL`; only the URL is safe to alias. */
function normalizeSupabaseEnvFromPublicAliases(): void {
  const pubUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!process.env.SUPABASE_URL?.trim() && pubUrl) {
    process.env.SUPABASE_URL = pubUrl;
  }
}
normalizeSupabaseEnvFromPublicAliases();

const REQUIRED_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "JWT_SECRET"] as const;

function requiredEnv(): void {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]?.trim());
  if (missing.length === 0) return;

  const hasPrimary = existsSync(envPrimary);
  const hasLocal = existsSync(envLocal);
  let hint =
    `Expected env files (create at least one):\n` +
    `  - ${envPrimary}${hasPrimary ? " (exists)" : " (missing)"}\n` +
    `  - ${envLocal}${hasLocal ? " (exists)" : " (missing)"}\n` +
    `Copy .env.example → .env, then set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (service_role key), and JWT_SECRET.\n` +
    `Supabase: Dashboard → Project Settings → API.`;
  if (missing.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    hint +=
      `\n\nUse the secret named "service_role" on that page (long value, often starts with eyJ). ` +
      `Do not use the publishable key (sb_publishable_…) or the anon key — those are for browser apps only.`;
  }

  if (missing.length === 1 && missing[0] === "SUPABASE_SERVICE_ROLE_KEY" && hasPrimary) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is empty or missing.\n\n` +
        `1. Open this file in an editor:\n   ${envPrimary}\n` +
        `2. Find the line: SUPABASE_SERVICE_ROLE_KEY=\n` +
        `3. Paste your key after the = with no spaces (one long line).\n` +
        `   Source: Supabase Dashboard → your project → Project Settings → API →\n` +
        `   section "Project API keys" → key named "service_role" → click Reveal → copy.\n` +
        `4. Save the file and start the server again.\n\n` +
        `That value is different from "anon" and from any "publishable" / sb_publishable key.`
    );
  }

  throw new Error(`Missing environment variable(s): ${missing.join(", ")}.\n${hint}`);
}

function required(key: (typeof REQUIRED_ENV)[number]): string {
  const value = process.env[key];
  if (!value?.trim()) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value.trim();
}

requiredEnv();

function assertSupabaseEnvNotPlaceholder(url: string, serviceRoleKey: string): void {
  const rawKey = serviceRoleKey.trim();
  if (/^sb_publishable_/i.test(rawKey)) {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY must be the "service_role" secret from Supabase (Dashboard → Project Settings → API).\n` +
        `You set the publishable key (sb_publishable_…). That is for the browser only; the Node API needs "service_role".\n` +
        `Reveal and copy "service_role" into SUPABASE_SERVICE_ROLE_KEY in backend-supabase/.env`
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
        `\nEdit one of these (save, then restart the server):\n  ${envPrimary}\n  ${envLocal}`
    );
  }
}

const _supabaseUrl = required("SUPABASE_URL");
const _serviceRole = required("SUPABASE_SERVICE_ROLE_KEY");
assertSupabaseEnvNotPlaceholder(_supabaseUrl, _serviceRole);

export const config = {
  port: Number(process.env.PORT ?? 4000),
  supabaseUrl: _supabaseUrl,
  supabaseServiceRoleKey: _serviceRole,
  jwtSecret: required("JWT_SECRET"),
  jwtAccessTtlSeconds: Number(process.env.JWT_ACCESS_TTL_SECONDS ?? 604800),
  jwtRefreshTtlSeconds: Number(process.env.JWT_REFRESH_TTL_SECONDS ?? 2592000)
};
