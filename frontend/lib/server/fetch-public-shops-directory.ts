import type { PublicShopListRow } from "@/lib/salon-api";
import { getServerSiteOrigin } from "@/lib/server/site-origin";

export type PublicShopsDirectoryPayload =
  | { ok: true; rows: PublicShopListRow[] }
  | { ok: false; message: string };

type FetchOpts = {
  search?: string;
  division?: string;
  district?: string;
  city?: string;
  perPage?: number;
};

/**
 * Server-only fetch for browse directory. Uses Next `revalidate` so repeat visits stay fast.
 * Does not send cookies or localStorage tokens (public endpoint).
 */
export async function fetchPublicShopsDirectoryOnServer(opts: FetchOpts = {}): Promise<PublicShopsDirectoryPayload> {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.division) params.set("division", opts.division);
  if (opts.district) params.set("district", opts.district);
  if (opts.city) params.set("city", opts.city);
  params.set("per_page", String(opts.perPage ?? 48));
  const q = params.toString();
  const url = `${getServerSiteOrigin()}/api/public/shops?${q}`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" }
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return { ok: false, message: "Invalid JSON from public shops API." };
    }
    if (!res.ok) {
      const msg = (body as { message?: string })?.message ?? `HTTP ${res.status}`;
      return { ok: false, message: msg };
    }
    const rows = (body as { data?: PublicShopListRow[] }).data;
    if (!Array.isArray(rows)) return { ok: false, message: "Unexpected public shops response." };
    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, message: msg };
  }
}
