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
    const url = await serverApiUrl(path);
    if (!url) return null;
    const res = await fetch(url, { ...init, next: { revalidate: 30 } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
