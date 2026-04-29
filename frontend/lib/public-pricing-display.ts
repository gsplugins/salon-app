/** Tier used for marketing / pricing display (aligned with catalog slugs). */
export type PublicPlanTier = "free" | "starter" | "pro" | "enterprise";

const TIER_RANK: Record<PublicPlanTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function inferPublicPlanTier(slug: string): PublicPlanTier {
  const segs = String(slug ?? "")
    .toLowerCase()
    .split(/[-_]/)
    .filter(Boolean);
  if (segs.includes("enterprise")) return "enterprise";
  if (segs.includes("pro")) return "pro";
  if (segs.includes("starter")) return "starter";
  if (segs.includes("free")) return "free";
  return "free";
}

export function tierAtLeast(tier: PublicPlanTier, minimum: PublicPlanTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minimum];
}

/** Stable column order on the pricing page. */
export const PUBLIC_PLAN_TIER_ORDER: PublicPlanTier[] = ["free", "starter", "pro", "enterprise"];

export type PricingFeatureDef = {
  id: string;
  label: string;
  minimum: PublicPlanTier;
};

export type PricingFeatureSection = {
  title: string;
  features: PricingFeatureDef[];
};

/** Feature rows shown on the public plans page (aligned with reference design). */
export const PRICING_FEATURE_SECTIONS: PricingFeatureSection[] = [
  {
    title: "Scheduling",
    features: [
      { id: "own_calendar", label: "Own calendar", minimum: "free" },
      { id: "walk_in_queue", label: "Walk-in queue", minimum: "free" },
      { id: "online_booking", label: "Online booking page", minimum: "free" },
      { id: "team_scheduling", label: "Team scheduling", minimum: "starter" },
      { id: "multi_location", label: "Multi-location pages", minimum: "pro" },
    ],
  },
  {
    title: "Business",
    features: [
      { id: "pos", label: "POS / payments", minimum: "starter" },
      { id: "sms", label: "SMS notifications", minimum: "pro" },
      { id: "analytics", label: "Analytics", minimum: "starter" },
      { id: "inventory", label: "Inventory tracking", minimum: "pro" },
      { id: "api_webhooks", label: "Full API + webhooks", minimum: "pro" },
      { id: "audit_log", label: "Audit log", minimum: "enterprise" },
    ],
  },
];
