"use client";

import { Check } from "lucide-react";

export type PlanKey = "free" | "starter" | "pro" | "enterprise";
export type ModuleKey =
  | "booking_calendar"
  | "client_list"
  | "staff_management"
  | "payments_pos"
  | "api_webhooks"
  | "audit_log";

export type PlanAccessMap = Record<PlanKey, Record<ModuleKey, string[]>>;

export const PLAN_LABELS: Record<PlanKey, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  enterprise: "Enterprise",
};

const MODULE_LABELS: Record<ModuleKey, string> = {
  booking_calendar: "Booking calendar",
  client_list: "Client list",
  staff_management: "Staff management",
  payments_pos: "Payments / POS",
  api_webhooks: "API / Webhooks",
  audit_log: "Audit log",
};

const MODULE_HELP: Record<ModuleKey, string> = {
  booking_calendar: "scoped by own | team | region | all",
  client_list: "scoped by own | unlimited, capped on Free",
  staff_management: "blocked for Barber/Receptionist at all tiers",
  payments_pos: "checkout_only | view_refund | full progression",
  api_webhooks: "none | read_key | full only at Pro+Enterprise",
  audit_log: "Enterprise-only, scoped by own_staff | region | global",
};

const MODULE_OPTIONS: Record<ModuleKey, string[]> = {
  booking_calendar: ["own", "team", "region", "all"],
  client_list: ["own", "capped_50", "unlimited"],
  staff_management: ["blocked_barber_receptionist", "owner_manager_only"],
  payments_pos: ["checkout_only", "view_refund", "full"],
  api_webhooks: ["none", "read_key", "full"],
  audit_log: ["none", "own_staff", "region", "global"],
};

const DEFAULT_PLAN_ACCESS: PlanAccessMap = {
  free: {
    booking_calendar: ["own"],
    client_list: ["capped_50"],
    staff_management: ["blocked_barber_receptionist"],
    payments_pos: ["checkout_only"],
    api_webhooks: ["none"],
    audit_log: ["none"],
  },
  starter: {
    booking_calendar: ["own", "team"],
    client_list: ["unlimited"],
    staff_management: ["owner_manager_only"],
    payments_pos: ["checkout_only", "view_refund"],
    api_webhooks: ["read_key"],
    audit_log: ["none"],
  },
  pro: {
    booking_calendar: ["own", "team", "region"],
    client_list: ["unlimited"],
    staff_management: ["owner_manager_only"],
    payments_pos: ["checkout_only", "view_refund", "full"],
    api_webhooks: ["read_key", "full"],
    audit_log: ["own_staff", "region"],
  },
  enterprise: {
    booking_calendar: ["own", "team", "region", "all"],
    client_list: ["unlimited"],
    staff_management: ["owner_manager_only"],
    payments_pos: ["checkout_only", "view_refund", "full"],
    api_webhooks: ["read_key", "full"],
    audit_log: ["own_staff", "region", "global"],
  },
};

export function inferPlanKeyFromSlug(slug: string): PlanKey {
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

export function normalizePlanAccess(input: unknown): PlanAccessMap {
  const next: PlanAccessMap = JSON.parse(JSON.stringify(DEFAULT_PLAN_ACCESS)) as PlanAccessMap;
  if (!input || typeof input !== "object") return next;
  for (const plan of Object.keys(PLAN_LABELS) as PlanKey[]) {
    const planRaw = (input as Record<string, unknown>)[plan];
    if (!planRaw || typeof planRaw !== "object") continue;
    for (const moduleKey of Object.keys(MODULE_LABELS) as ModuleKey[]) {
      const candidate = (planRaw as Record<string, unknown>)[moduleKey];
      if (!Array.isArray(candidate)) continue;
      const allowed = MODULE_OPTIONS[moduleKey].filter((opt) => {
        if (moduleKey === "api_webhooks" && (plan === "free" || plan === "starter")) return opt !== "full";
        if (moduleKey === "audit_log" && plan !== "enterprise") return opt === "none";
        return true;
      });
      const picked = candidate.filter((x): x is string => typeof x === "string" && allowed.includes(x));
      if (picked.length > 0) next[plan][moduleKey] = picked;
    }
  }
  return next;
}

/** Returns a new map (immutable). */
export function togglePlanAccessFeature(
  map: PlanAccessMap,
  plan: PlanKey,
  moduleKey: ModuleKey,
  option: string,
): PlanAccessMap {
  const current = map[plan][moduleKey] ?? [];
  let nextValues: string[];
  if (option === "none") {
    nextValues = ["none"];
  } else {
    const withoutNone = current.filter((x) => x !== "none");
    const exists = withoutNone.includes(option);
    nextValues = exists ? withoutNone.filter((x) => x !== option) : [...withoutNone, option];
  }
  return {
    ...map,
    [plan]: {
      ...map[plan],
      [moduleKey]: nextValues.length > 0 ? nextValues : ["none"],
    },
  };
}

export function PlanAccessModuleGrid({
  planKey,
  planAccess,
  onToggle,
}: {
  planKey: PlanKey;
  planAccess: PlanAccessMap;
  onToggle: (plan: PlanKey, moduleKey: ModuleKey, option: string) => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {(Object.keys(MODULE_LABELS) as ModuleKey[]).map((moduleKey) => {
        const options = MODULE_OPTIONS[moduleKey].filter((opt) => {
          if (moduleKey === "api_webhooks" && (planKey === "free" || planKey === "starter")) return opt !== "full";
          if (moduleKey === "audit_log" && planKey !== "enterprise") return opt === "none";
          return true;
        });
        return (
          <div key={moduleKey} className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{MODULE_LABELS[moduleKey]}</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">{MODULE_HELP[moduleKey]}</p>
              </div>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                {(planAccess[planKey][moduleKey] ?? []).length} selected
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {options.map((opt) => {
                const checked = (planAccess[planKey][moduleKey] ?? []).includes(opt);
                return (
                  <button
                    key={opt}
                    type="button"
                    aria-pressed={checked}
                    onClick={() => onToggle(planKey, moduleKey, opt)}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition ${
                      checked
                        ? "border-emerald-500 bg-emerald-50 text-emerald-900 dark:border-emerald-400 dark:bg-emerald-950/30 dark:text-emerald-100"
                        : "border-zinc-200 bg-white text-zinc-800 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    }`}
                  >
                    <span>{opt}</span>
                    <span
                      className={`inline-flex h-5 w-5 items-center justify-center rounded border ${
                        checked
                          ? "border-emerald-600 bg-emerald-600 text-white dark:border-emerald-400 dark:bg-emerald-400 dark:text-zinc-900"
                          : "border-zinc-300 bg-transparent text-transparent dark:border-zinc-600"
                      }`}
                    >
                      <Check className="h-3.5 w-3.5" />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
