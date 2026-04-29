"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  inferPlanKeyFromSlug,
  normalizePlanAccess,
  PlanAccessModuleGrid,
  PLAN_LABELS,
  togglePlanAccessFeature,
  type PlanAccessMap,
  type PlanKey,
} from "@/components/admin/plan-access-settings-card";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  deleteSubscriptionPlan,
  fetchAdminPermissions,
  fetchSubscriptionPlans,
  formatApiError,
  patchSubscriptionPlan,
  postSubscriptionPlan,
  putAdminPermissions,
  type SubscriptionPlanRow,
} from "@/lib/admin-api";
import { fetchSystemShops, type Paginated, type SystemShopRow } from "@/lib/salon-api";

const SUBSCRIBERS_PER_PAGE = 20;

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(parsed);
}

function daysLeftUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const target = new Date(iso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.ceil(diffMs / 86_400_000);
}

function parseFeatureJson(input: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(input);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

const planSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional().or(z.literal("")),
  price_cents: z.coerce.number().int().min(0),
  currency: z.string().max(8),
  billing_cycle: z.enum(["monthly", "yearly"]),
  trial_days: z.coerce.number().int().min(0).max(3650),
  features_json: z
    .string()
    .min(2)
    .refine((v) => parseFeatureJson(v) !== null, "Features must be a valid JSON object"),
  is_active: z.boolean(),
  sort_order: z.coerce.number().int().min(0),
});

/** Parsed plan form (`z.coerce` output); explicit so RHF + Zod 4 resolver types align. */
type PlanForm = z.output<typeof planSchema>;

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<SubscriptionPlanRow[] | null>(null);
  const [subscribers, setSubscribers] = useState<Paginated<SystemShopRow> | null>(null);
  const [editing, setEditing] = useState<SubscriptionPlanRow | "new" | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [subscriberPage, setSubscriberPage] = useState(1);
  const [subscriberSearchDraft, setSubscriberSearchDraft] = useState("");
  const [subscriberSearch, setSubscriberSearch] = useState("");
  const [subscriberStatus, setSubscriberStatus] = useState<"all" | "active" | "expired" | "trialing">("all");
  /** Full plan_access map while plan dialog is open; persisted with Save. */
  const [dialogPlanAccess, setDialogPlanAccess] = useState<PlanAccessMap | null>(null);
  const [accessTier, setAccessTier] = useState<PlanKey>("free");

  const load = useCallback(async () => {
    const res = await fetchSubscriptionPlans(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  const loadSubscribers = useCallback(async () => {
    const res = await fetchSystemShops(token, {
      page: subscriberPage,
      search: subscriberSearch || undefined,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setSubscribers({ data: [], current_page: 1, last_page: 1, per_page: SUBSCRIBERS_PER_PAGE, total: 0 });
      return;
    }
    setSubscribers(res.data);
  }, [subscriberPage, subscriberSearch, token]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSubscribers();
  }, [loadSubscribers]);

  useEffect(() => {
    if (editing === null) {
      setDialogPlanAccess(null);
      return;
    }
    setAccessTier(editing === "new" ? "free" : inferPlanKeyFromSlug(editing.slug));
    let cancelled = false;
    void (async () => {
      const res = await fetchAdminPermissions(token);
      if (cancelled) return;
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        setDialogPlanAccess(null);
        return;
      }
      const overrides = (res.data.overrides ?? {}) as Record<string, unknown>;
      setDialogPlanAccess(normalizePlanAccess(overrides.plan_access));
    })();
    return () => {
      cancelled = true;
    };
  }, [editing, token]);

  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema) as Resolver<PlanForm>,
    defaultValues: {
      slug: "",
      name: "",
      description: "",
      price_cents: 0,
      currency: "BDT",
      billing_cycle: "monthly",
      trial_days: 0,
      features_json: JSON.stringify(
        {
          max_staff: 10,
          max_branches: 1,
          sms_enabled: false,
          analytics_enabled: true,
        },
        null,
        2,
      ),
      is_active: true,
      sort_order: 0,
    },
  });

  useEffect(() => {
    if (editing === "new") {
      form.reset({
        slug: "",
        name: "",
        description: "",
        price_cents: 0,
        currency: "BDT",
        billing_cycle: "monthly",
        trial_days: 7,
        features_json: JSON.stringify(
          {
            max_staff: 10,
            max_branches: 1,
            sms_enabled: false,
            analytics_enabled: true,
          },
          null,
          2,
        ),
        is_active: true,
        sort_order: (rows?.length ?? 0) * 10 + 10,
      });
    } else if (editing) {
      form.reset({
        slug: editing.slug,
        name: editing.name,
        description: editing.description ?? "",
        price_cents: editing.price_cents,
        currency: editing.currency,
        billing_cycle: editing.billing_cycle as "monthly" | "yearly",
        trial_days: editing.trial_days,
        features_json: JSON.stringify((editing.features ?? {}) as Record<string, unknown>, null, 2),
        is_active: editing.is_active,
        sort_order: editing.sort_order,
      });
    }
  }, [editing, form, rows?.length]);

  async function submit(values: PlanForm) {
    const features = parseFeatureJson(values.features_json);
    if (!features) {
      toast.error("Features must be a valid JSON object.");
      return;
    }
    const payload = {
      slug: values.slug,
      name: values.name,
      description: values.description || null,
      price_cents: values.price_cents,
      currency: values.currency,
      billing_cycle: values.billing_cycle,
      trial_days: values.trial_days,
      features,
      is_active: values.is_active,
      sort_order: values.sort_order,
    };
    if (editing === "new") {
      const res = await postSubscriptionPlan(token, payload);
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        return;
      }
      if (dialogPlanAccess) {
        const permRes = await putAdminPermissions(token, { plan_access: dialogPlanAccess });
        if (!permRes.ok) {
          toast.error(`Plan created, but plan access rules failed to save: ${formatApiError(permRes.body)}`);
          setEditing(null);
          void load();
          return;
        }
      }
      toast.success("Plan created.");
    } else if (editing) {
      const { slug: _s, ...patchBody } = payload;
      void _s;
      const res = await patchSubscriptionPlan(token, editing.id, patchBody);
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        return;
      }
      if (dialogPlanAccess) {
        const permRes = await putAdminPermissions(token, { plan_access: dialogPlanAccess });
        if (!permRes.ok) {
          toast.error(`Plan updated, but plan access rules failed to save: ${formatApiError(permRes.body)}`);
          setEditing(null);
          void load();
          return;
        }
      }
      toast.success("Plan updated.");
    }
    setEditing(null);
    void load();
  }

  async function confirmDelete() {
    if (deleteId === null) return;
    const res = await deleteSubscriptionPlan(token, deleteId);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Plan deleted.");
    setDeleteId(null);
    void load();
  }

  if (!rows || !subscribers) {
    return (
      <AdminWorkspaceFrame title="Subscription plans" subtitle="Catalog pricing, trials, and feature flags.">
        <div className="space-y-4">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </div>
      </AdminWorkspaceFrame>
    );
  }

  const visibleSubscribers = subscribers.data.filter((shop) => {
    if (!shop.subscription) return false;
    if (subscriberStatus === "all") return true;
    if (subscriberStatus === "trialing") return shop.subscription.status === "trialing";
    const daysLeft = daysLeftUntil(shop.subscription.current_period_end);
    if (subscriberStatus === "expired") return daysLeft !== null && daysLeft < 0;
    if (subscriberStatus === "active") return daysLeft === null || daysLeft >= 0;
    return true;
  });

  return (
    <AdminWorkspaceFrame
      title="Subscription plans"
      subtitle="Catalog pricing and trials. Plan access (by tier) is edited inside each plan’s create/edit dialog."
    >
      <div className="mb-4 space-y-4">
        <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <Label htmlFor="subscriber-search">Search shop</Label>
              <Input
                id="subscriber-search"
                className="mt-1"
                placeholder="Shop name or slug"
                value={subscriberSearchDraft}
                onChange={(e) => setSubscriberSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  setSubscriberPage(1);
                  setSubscriberSearch(subscriberSearchDraft.trim());
                }}
              />
            </div>
            <div className="min-w-[180px]">
              <Label htmlFor="subscriber-status">Subscription status</Label>
              <select
                id="subscriber-status"
                className="mt-1 h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={subscriberStatus}
                onChange={(e) => setSubscriberStatus(e.target.value as "all" | "active" | "expired" | "trialing")}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="trialing">Trialing</option>
                <option value="expired">Expired</option>
              </select>
            </div>
            <Button
              type="button"
              onClick={() => {
                setSubscriberPage(1);
                setSubscriberSearch(subscriberSearchDraft.trim());
              }}
            >
              Apply
            </Button>
          </div>

          <Table>
            <THead>
              <TR>
                <TH>Shop</TH>
                <TH>Plan</TH>
                <TH>Status</TH>
                <TH>Active from</TH>
                <TH>Expires</TH>
                <TH>Days left</TH>
              </TR>
            </THead>
            <TBody>
              {visibleSubscribers.map((shop) => {
                const sub = shop.subscription!;
                const daysLeft = daysLeftUntil(sub.current_period_end);
                return (
                  <TR key={shop.id}>
                    <TD>
                      <div className="font-medium">{shop.name}</div>
                      <div className="font-mono text-xs text-zinc-800">/{shop.slug}</div>
                    </TD>
                    <TD className="font-medium">{sub.plan_key}</TD>
                    <TD>
                      <Badge variant={sub.status === "active" ? "success" : "warning"}>{sub.status}</Badge>
                    </TD>
                    <TD>{formatDate(sub.active_from)}</TD>
                    <TD>{formatDate(sub.current_period_end)}</TD>
                    <TD>
                      {daysLeft === null ? (
                        "—"
                      ) : daysLeft < 0 ? (
                        <span className="font-medium text-red-600 dark:text-red-400">{Math.abs(daysLeft)} days overdue</span>
                      ) : (
                        <span className="font-medium text-emerald-700 dark:text-emerald-400">{daysLeft} days</span>
                      )}
                    </TD>
                  </TR>
                );
              })}
              {visibleSubscribers.length === 0 ? (
                <TR>
                  <TD colSpan={6} className="py-8 text-center text-zinc-800">
                    No subscribers found for this filter.
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-zinc-800">
              Page {subscribers.current_page} of {subscribers.last_page} · {subscribers.total} total subscribers
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={subscriberPage <= 1}
                onClick={() => setSubscriberPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={subscriberPage >= subscribers.last_page}
                onClick={() => setSubscriberPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-between gap-2">
          <h2 className="text-lg font-semibold">Subscription plan catalog</h2>
          <Button type="button" onClick={() => setEditing("new")}>
            New plan
          </Button>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Slug</TH>
            <TH>Price</TH>
            <TH>Cycle</TH>
            <TH>Trial</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((p) => (
            <TR key={p.id}>
              <TD className="font-medium">{p.name}</TD>
              <TD className="font-mono text-xs">{p.slug}</TD>
              <TD>
                {(p.price_cents / 100).toFixed(2)} {p.currency}
              </TD>
              <TD>{p.billing_cycle}</TD>
              <TD>{p.trial_days}d</TD>
              <TD>
                <Badge variant={p.is_active ? "success" : "warning"}>{p.is_active ? "Active" : "Off"}</Badge>
              </TD>
              <TD className="text-right space-x-1">
                <Button type="button" variant="ghost" className="h-8 px-2" onClick={() => setEditing(p)}>
                  Edit
                </Button>
                <Button type="button" variant="destructive" className="h-8 px-2" onClick={() => setDeleteId(p.id)}>
                  Delete
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Create plan" : "Edit plan"}</DialogTitle>
            <DialogDescription>
              Catalog fields and features JSON are stored on the plan row. Plan access (by tier) updates platform
              role-permission overrides (<span className="font-mono">plan_access</span>).
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-3" onSubmit={form.handleSubmit(submit)}>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input {...form.register("slug")} disabled={editing !== "new"} />
              </div>
              <div className="grid gap-2">
                <Label>Name</Label>
                <Input {...form.register("name")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Description</Label>
              <Textarea {...form.register("description")} />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label>Price (minor units)</Label>
                <Input type="number" {...form.register("price_cents")} />
              </div>
              <div className="grid gap-2">
                <Label>Currency</Label>
                <Input {...form.register("currency")} />
              </div>
              <div className="grid gap-2">
                <Label>Billing</Label>
                <select
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  {...form.register("billing_cycle")}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Trial days</Label>
                <Input type="number" {...form.register("trial_days")} />
              </div>
              <div className="grid gap-2">
                <Label>Sort order</Label>
                <Input type="number" {...form.register("sort_order")} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>All features JSON</Label>
              <Textarea
                className="min-h-[180px] font-mono text-xs"
                placeholder='{"max_staff":10,"max_branches":1,"sms_enabled":false,"analytics_enabled":true}'
                {...form.register("features_json")}
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Advanced: this JSON is stored directly on the plan as <span className="font-mono">features</span>. Add any
                extra flags needed for this tier.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
              <div className="mb-3">
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Plan access (by tier)</p>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  Choose which tier you are configuring, then set module access. This is saved when you click Save below
                  (stored with other plan access overrides).
                </p>
              </div>
              <div className="mb-4 grid gap-2 sm:max-w-xs">
                <Label htmlFor="plan-access-tier">Tier to edit</Label>
                <select
                  id="plan-access-tier"
                  className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={accessTier}
                  onChange={(e) => setAccessTier(e.target.value as PlanKey)}
                >
                  {(Object.keys(PLAN_LABELS) as PlanKey[]).map((k) => (
                    <option key={k} value={k}>
                      {PLAN_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              {dialogPlanAccess ? (
                <>
                  <div className="mb-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                    Editing <span className="font-semibold">{PLAN_LABELS[accessTier]}</span> · Multi-select per module.
                  </div>
                  <PlanAccessModuleGrid
                    planKey={accessTier}
                    planAccess={dialogPlanAccess}
                    onToggle={(plan, moduleKey, option) =>
                      setDialogPlanAccess((prev) => (prev ? togglePlanAccessFeature(prev, plan, moduleKey, option) : prev))
                    }
                  />
                </>
              ) : (
                <div className="space-y-2">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <Skeleton className="h-24 w-full rounded-xl" />
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Loading plan access rules… If this stays empty, fix permissions API and try again.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.watch("is_active")} onCheckedChange={(v) => form.setValue("is_active", v)} />
                <span className="text-sm">Plan active</span>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete plan?</DialogTitle>
            <DialogDescription>Only allowed when no shop subscription references this plan.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminWorkspaceFrame>
  );
}

export function AdminSubscriptionsClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
