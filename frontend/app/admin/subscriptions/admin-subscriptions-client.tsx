"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
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

type PlanForm = z.infer<typeof planSchema>;

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<SubscriptionPlanRow[] | null>(null);
  const [editing, setEditing] = useState<SubscriptionPlanRow | "new" | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetchSubscriptionPlans(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const form = useForm<PlanForm>({
    resolver: zodResolver(planSchema),
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
    } else if (editing && editing !== "new") {
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
    } else if (editing && editing !== "new") {
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

  if (!rows) {
    return (
      <AdminWorkspaceFrame title="Subscription plans" subtitle="Catalog pricing, trials, and feature flags.">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  return (
    <AdminWorkspaceFrame
      title="Subscription plans"
      subtitle="Create and manage Free, Basic, Pro, and Enterprise-style plans. Shops reference these rows via manual assignment or future checkout."
    >
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <Button type="button" onClick={() => setEditing("new")}>
          New plan
        </Button>
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
