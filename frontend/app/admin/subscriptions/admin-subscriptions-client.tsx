"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
  fetchSubscriptionPlans,
  formatApiError,
  patchSubscriptionPlan,
  postSubscriptionPlan,
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

const planSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  name: z.string().min(1).max(255),
  description: z.string().max(5000).optional().or(z.literal("")),
  price_cents: z.coerce.number().int().min(0),
  currency: z.string().max(8),
  billing_cycle: z.enum(["monthly", "yearly"]),
  trial_days: z.coerce.number().int().min(0).max(3650),
  max_staff: z.coerce.number().int().min(1),
  max_branches: z.coerce.number().int().min(1),
  sms_enabled: z.boolean(),
  analytics_enabled: z.boolean(),
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
      max_staff: 10,
      max_branches: 1,
      sms_enabled: false,
      analytics_enabled: true,
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
        max_staff: 10,
        max_branches: 1,
        sms_enabled: false,
        analytics_enabled: true,
        is_active: true,
        sort_order: (rows?.length ?? 0) * 10 + 10,
      });
    } else if (editing) {
      const f = (editing.features ?? {}) as Record<string, unknown>;
      form.reset({
        slug: editing.slug,
        name: editing.name,
        description: editing.description ?? "",
        price_cents: editing.price_cents,
        currency: editing.currency,
        billing_cycle: editing.billing_cycle as "monthly" | "yearly",
        trial_days: editing.trial_days,
        max_staff: Number(f.max_staff ?? 10),
        max_branches: Number(f.max_branches ?? 1),
        sms_enabled: Boolean(f.sms_enabled),
        analytics_enabled: Boolean(f.analytics_enabled ?? true),
        is_active: editing.is_active,
        sort_order: editing.sort_order,
      });
    }
  }, [editing, form, rows?.length]);

  async function submit(values: PlanForm) {
    const features = {
      max_staff: values.max_staff,
      max_branches: values.max_branches,
      sms_enabled: values.sms_enabled,
      analytics_enabled: values.analytics_enabled,
    };
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
      toast.success("Plan created.");
    } else if (editing) {
      const { slug: _s, ...patchBody } = payload;
      void _s;
      const res = await patchSubscriptionPlan(token, editing.id, patchBody);
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        return;
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
      subtitle="Create and manage Free, Basic, Pro, and Enterprise-style plans. Shops reference these rows via manual assignment or future checkout."
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
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing === "new" ? "Create plan" : "Edit plan"}</DialogTitle>
            <DialogDescription>Feature flags are stored as JSON on the plan record.</DialogDescription>
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
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Max staff</Label>
                <Input type="number" {...form.register("max_staff")} />
              </div>
              <div className="grid gap-2">
                <Label>Max branches</Label>
                <Input type="number" {...form.register("max_branches")} />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.watch("sms_enabled")} onCheckedChange={(v) => form.setValue("sms_enabled", v)} />
                <span className="text-sm">SMS enabled</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.watch("analytics_enabled")}
                  onCheckedChange={(v) => form.setValue("analytics_enabled", v)}
                />
                <span className="text-sm">Analytics</span>
              </div>
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
