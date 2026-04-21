import type { ShopProfile } from "@/lib/salon-api";

export function shopPlanFeatures(profile: ShopProfile | null): Record<string, unknown> {
  const f = profile?.subscription?.features;
  return f && typeof f === "object" && !Array.isArray(f) ? (f as Record<string, unknown>) : {};
}

export function shopPlanHasLoyalty(profile: ShopProfile | null): boolean {
  return Boolean(shopPlanFeatures(profile).loyalty_enabled);
}

export function shopPlanHasMultiBranch(profile: ShopProfile | null): boolean {
  return Boolean(shopPlanFeatures(profile).multi_branch_enabled);
}
