"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  inferPublicPlanTier,
  PRICING_FEATURE_SECTIONS,
  tierAtLeast,
  type PublicPlanTier,
  PUBLIC_PLAN_TIER_ORDER,
} from "@/lib/public-pricing-display";

type PlanRow = {
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

function tierSortKey(slug: string): number {
  const t = inferPublicPlanTier(slug);
  const i = PUBLIC_PLAN_TIER_ORDER.indexOf(t);
  return i === -1 ? 99 : i;
}

function formatMoney(priceCents: number, currency: string): string {
  const value = Number(priceCents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "BDT", maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${Math.round(value)} ${currency}`;
  }
}

function billingSuffix(cycle: string): string {
  const c = (cycle || "monthly").toLowerCase();
  if (c === "yearly" || c === "annual") return "/ yr";
  return "/ mo";
}

function constraintLine(plan: PlanRow, tier: PublicPlanTier): string {
  const f = (plan.features ?? {}) as Record<string, unknown>;
  const maxStaff = Math.max(1, Number(f.max_staff ?? 1));
  const maxBranches = Math.max(1, Number(f.max_branches ?? 1));

  if (tier === "enterprise") {
    return maxStaff >= 999 ? "Unlimited scale · custom terms" : `Up to ${maxStaff} staff · tailor-made`;
  }
  if (maxBranches > 1) {
    return `Up to ${maxStaff} staff · ${maxBranches} locations`;
  }
  if (maxStaff <= 1) return "1 barber seat";
  return `Up to ${maxStaff} barbers`;
}

function priceBlock(plan: PlanRow, tier: PublicPlanTier): { main: string; sub: string } {
  const cycle = billingSuffix(plan.billing_cycle);
  if (tier === "enterprise" && plan.price_cents === 0) {
    return { main: "Custom", sub: "Let’s tailor a package" };
  }
  const main = formatMoney(plan.price_cents, plan.currency);
  return { main, sub: cycle.trim() };
}

function ctaForTier(tier: PublicPlanTier, trialDays: number): { label: string; href: string } {
  if (tier === "enterprise") return { label: "Contact sales", href: "/app?intent=enterprise" };
  if (tier === "pro" && trialDays > 0) return { label: "Start free trial", href: "/app?intent=trial" };
  return { label: "Get started", href: "/app" };
}

export function PublicPlansClient() {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/public/subscription-plans");
      const body = (await res.json().catch(() => ({}))) as { data?: PlanRow[]; message?: string };
      if (!res.ok) {
        setError(body.message ?? "Could not load plans.");
        setLoading(false);
        return;
      }
      const raw = Array.isArray(body.data) ? body.data : [];
      raw.sort((a, b) => tierSortKey(a.slug) - tierSortKey(b.slug) || a.id - b.id);
      setPlans(raw);
      setLoading(false);
    })();
  }, []);

  const columns = useMemo(() => plans, [plans]);

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-[520px] animate-pulse rounded-2xl border border-[color:var(--border)] bg-[color:var(--surface)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-700 dark:text-red-400">{error}</p>;
  }

  if (columns.length === 0) {
    return <p className="text-sm text-[color:var(--caption)]">No active plans available yet.</p>;
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-5">
      {columns.map((plan) => (
        <PlanPricingCard key={plan.id} plan={plan} />
      ))}
    </div>
  );
}

function PlanPricingCard({ plan }: { plan: PlanRow }) {
  const tier = inferPublicPlanTier(plan.slug);
  const popular = tier === "pro";
  const { main: priceMain, sub: priceSub } = priceBlock(plan, tier);
  const constraint = constraintLine(plan, tier);
  const cta = ctaForTier(tier, plan.trial_days);
  const tagline = plan.description?.trim() || defaultTagline(tier);

  return (
    <article
      className={[
        "relative flex h-full min-h-[480px] flex-col overflow-hidden rounded-2xl border bg-[color:var(--surface)] shadow-sm transition-shadow",
        popular
          ? "border-4 border-[color:var(--border)] shadow-md shadow-[#1e3a8a]/10"
          : "border-[color:var(--border)]",
      ].join(" ")}
    >
      {popular ? (
        <div className="absolute left-1/2 top-0 z-10 -translate-x-1/2 -translate-y-px">
          <span className="inline-block rounded-b-lg bg-[color:var(--border)] px-4 py-1 text-xs font-semibold text-white">
            Most popular
          </span>
        </div>
      ) : null}

      <div className={`flex flex-1 flex-col px-5 pb-4 ${popular ? "pt-14" : "pt-8"}`}>
        <h2 className="text-xl font-bold tracking-tight text-[color:var(--foreground)]">{plan.name}</h2>
        <p className="mt-1.5 min-h-[2.5rem] text-sm leading-snug text-[color:var(--paragraph)]">{tagline}</p>

        <div className="mt-5">
          <div className="flex flex-wrap items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-[color:var(--foreground)]">{priceMain}</span>
            {priceMain !== "Custom" ? (
              <span className="text-base font-medium text-[color:var(--caption)]">{priceSub}</span>
            ) : null}
          </div>
          <p className="mt-1.5 text-sm text-[color:var(--paragraph)]">{constraint}</p>
          {plan.trial_days > 0 && tier !== "enterprise" ? (
            <p className="mt-1 text-xs font-medium text-emerald-700">{plan.trial_days}-day trial</p>
          ) : null}
        </div>

        <hr className="my-6 border-[color:var(--border)]" />

        <div className="flex flex-col gap-6">
          {PRICING_FEATURE_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[color:var(--caption)]">
                {section.title}
              </p>
              <ul className="mt-3 space-y-2.5">
                {section.features.map((feat) => {
                  const enabled = tierAtLeast(tier, feat.minimum);
                  return (
                    <li key={feat.id} className="flex items-start gap-2.5">
                      <span
                        className={[
                          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold leading-none",
                          enabled
                            ? "bg-[var(--border)] text-white shadow-sm shadow-[0_1px_8px_rgba(179,92,110,0.25)]"
                            : "border border-[color:color-mix(in srgb,var(--caption)35%,transparent)] bg-[color:color-mix(in srgb,var(--caption)8%,transparent)] text-[9px] text-[color:var(--caption)]",
                        ].join(" ")}
                        aria-hidden
                      >
                        {enabled ? "✓" : "\u2022"}
                      </span>
                      <span
                        className={[
                          "text-sm leading-snug",
                          enabled ? "text-[color:var(--foreground)]" : "text-[color:var(--caption)]",
                        ].join(" ")}
                      >
                        {feat.label}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-auto border-t border-[color:var(--border)] bg-[color:color-mix(in srgb,var(--surface-elevated)70%,var(--surface))] px-5 py-4">
        <Link
          href={cta.href}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--surface)] px-4 py-2.5 text-sm font-semibold text-[color:var(--foreground)] shadow-sm transition hover:border-[color:var(--brand-primary)] hover:text-[color:var(--brand-primary)]"
        >
          {cta.label}
          <ArrowUpRight className="h-4 w-4 opacity-80" aria-hidden />
        </Link>
      </div>
    </article>
  );
}

function defaultTagline(tier: PublicPlanTier): string {
  switch (tier) {
    case "free":
      return "Solo barber, get started";
    case "starter":
      return "Small team, room to grow";
    case "pro":
      return "Full shop operations";
    case "enterprise":
      return "Chains & multi-site brands";
    default:
      return "Everything you need to run your shop";
  }
}
