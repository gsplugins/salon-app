import { headers } from "next/headers";

/**
 * Server Components: build same-origin API URL (Next rewrites to `BACKEND_URL`).
 */
export async function serverApiUrl(path: string): Promise<string | null> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  if (!host) return null;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${proto}://${host}${p.startsWith("/api") ? p : `/api${p}`}`;
}

export async function serverFetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const h = await headers();
    const url = await serverApiUrl(path);
    if (!url) return null;
    const forwardedHeaders = new Headers(init?.headers);
    // Forward caller context so same-origin API calls work in protected environments (e.g. Vercel auth/protection).
    for (const key of [
      "cookie",
      "authorization",
      "x-vercel-protection-bypass",
      "x-vercel-set-bypass-cookie",
      "x-forwarded-host",
      "x-forwarded-proto"
    ]) {
      const v = h.get(key);
      if (v && !forwardedHeaders.has(key)) forwardedHeaders.set(key, v);
    }
    const res = await fetch(url, { ...init, headers: forwardedHeaders, next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
