import { getServerSiteOrigin } from "@/lib/server/site-origin";

export type PublicSubscriptionPlanRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  trial_days: number;
  features: Record<string, unknown> | null;
};

export type PublicSubscriptionPlansPayload =
  | { ok: true; plans: PublicSubscriptionPlanRow[] }
  | { ok: false; message: string };

/** Server-only fetch; uses Next cache (revalidate) matching `/api/public/subscription-plans`. */
export async function fetchPublicSubscriptionPlansOnServer(): Promise<PublicSubscriptionPlansPayload> {
  const url = `${getServerSiteOrigin()}/api/public/subscription-plans`;
  try {
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: { Accept: "application/json" },
    });
    const text = await res.text();
    let body: unknown = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      return { ok: false, message: "Invalid JSON from subscription plans API." };
    }
    if (!res.ok) {
      const msg = (body as { message?: string })?.message ?? `HTTP ${res.status}`;
      return { ok: false, message: msg };
    }
    const raw = (body as { data?: PublicSubscriptionPlanRow[] }).data;
    if (!Array.isArray(raw)) return { ok: false, message: "Unexpected subscription plans response." };
    return { ok: true, plans: raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Network error";
    return { ok: false, message: msg };
  }
}
