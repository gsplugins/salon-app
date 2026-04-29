import type { ShopProfile } from "@/lib/salon-api";

export type PlanTier = "free" | "starter" | "pro" | "enterprise";

const PLAN_ORDER: PlanTier[] = ["free", "starter", "pro", "enterprise"];

const SEGMENT_PLAN_REQUIREMENTS: Record<string, PlanTier> = {
  staff: "starter",
  payments: "starter",
  analytics: "starter",
  reports: "pro",
  inventory: "pro",
  branches: "pro",
  loyalty: "pro",
};

const SEGMENT_MODULE_MAP: Record<string, string> = {
  appointments: "booking_calendar",
  booking: "booking_calendar",
  customers: "client_list",
  staff: "staff_management",
  payments: "payments_pos",
};

export function normalizePlanTier(raw: string | null | undefined): PlanTier {
  const v = String(raw ?? "").trim().toLowerCase();
  if (v === "starter" || v === "pro" || v === "enterprise") return v;
  return "free";
}

export function planTierLabel(plan: PlanTier): string {
  if (plan === "starter") return "Starter";
  if (plan === "pro") return "Pro";
  if (plan === "enterprise") return "Enterprise";
  return "Free";
}

export function currentPlanTier(profile: ShopProfile | null): PlanTier {
  return normalizePlanTier(profile?.subscription?.plan_key ?? profile?.subscription?.plan_name ?? "free");
}

export function isPlanAtLeast(current: PlanTier, required: PlanTier): boolean {
  return PLAN_ORDER.indexOf(current) >= PLAN_ORDER.indexOf(required);
}

export function requiredPlanForSegment(segment: string | null | undefined): PlanTier | null {
  if (!segment) return null;
  return SEGMENT_PLAN_REQUIREMENTS[segment] ?? null;
}

export function isSegmentAllowedForPlan(plan: PlanTier, segment: string | null | undefined): boolean {
  const required = requiredPlanForSegment(segment);
  if (!required) return true;
  return isPlanAtLeast(plan, required);
}

/**
 * Checks dynamic plan_access module overrides first; if not configured for a segment,
 * falls back to static tier-based minimums.
 */
export function isSegmentAllowedForProfile(profile: ShopProfile | null, segment: string | null | undefined): boolean {
  const seg = String(segment ?? "").trim();
  if (!seg) return true;
  const moduleKey = SEGMENT_MODULE_MAP[seg];
  if (moduleKey) {
    const modules = profile?.permissions?.plan_access_modules;
    const values = Array.isArray(modules?.[moduleKey]) ? (modules?.[moduleKey] as string[]) : null;
    if (values) {
      return values.some((v) => v !== "none");
    }
  }
  const plan = currentPlanTier(profile);
  return isSegmentAllowedForPlan(plan, seg);
}

