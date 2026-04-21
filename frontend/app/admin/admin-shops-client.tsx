"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, PauseCircle, PlayCircle, Search, Store, Trash2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchSubscriptionPlans, patchShopSubscriptionPlan } from "@/lib/admin-api";
import {
  deleteSystemShop,
  fetchSystemShops,
  formatApiError,
  patchSystemShop,
  type Paginated,
  type SystemShopFilter,
  type SystemShopRow,
} from "@/lib/salon-api";
import { ownerShopBase } from "@/lib/owner-shop-paths";

const FILTERS: { id: SystemShopFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "unpaid", label: "Unpaid" },
  { id: "expired", label: "Expired" },
  { id: "locked", label: "Locked" },
];

function formatWhen(iso: string | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(iso));
}

function approvalLabel(status: string | undefined): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

type PlanOpt = { id: number; slug: string; name: string };

function Body({ token }: { token: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<SystemShopFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [planKey, setPlanKey] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<SystemShopRow> | null>(null);
  const [busy, setBusy] = useState(true);
  const [plans, setPlans] = useState<PlanOpt[]>([]);
  const [deleteTarget, setDeleteTarget] = useState<SystemShopRow | null>(null);
  const [assignTarget, setAssignTarget] = useState<SystemShopRow | null>(null);
  const [assignPlanId, setAssignPlanId] = useState<string>("");

  useEffect(() => {
    void (async () => {
      const res = await fetchSubscriptionPlans(token);
      if (res.ok) {
        setPlans(res.data.map((p) => ({ id: p.id, slug: p.slug, name: p.name })));
      }
    })();
  }, [token]);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchSystemShops(token, {
      filter,
      page,
      search: search || undefined,
      plan_key: planKey.trim() || undefined,
      created_from: createdFrom || undefined,
      created_to: createdTo || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token, filter, page, search, planKey, createdFrom, createdTo]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load shops
    void load();
  }, [load]);

  async function toggleActive(row: SystemShopRow) {
    const res = await patchSystemShop(token, row.id, { is_active: !row.is_active });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success(row.is_active ? "Salon suspended." : "Salon activated.");
    void load();
  }

  async function removeShop() {
    if (!deleteTarget) return;
    const res = await deleteSystemShop(token, deleteTarget.id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Shop deleted.");
    setDeleteTarget(null);
    void load();
  }

  async function submitAssignPlan() {
    if (!assignTarget) return;
    const id = Number.parseInt(assignPlanId, 10);
    if (Number.isNaN(id)) {
      toast.error("Pick a plan.");
      return;
    }
    const res = await patchShopSubscriptionPlan(token, assignTarget.id, id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Subscription plan updated.");
    setAssignTarget(null);
    void load();
  }

  function openSalonDashboard(row: SystemShopRow) {
    router.push(ownerShopBase(row.slug));
  }

  if (busy || !data) {
    return (
      <AdminWorkspaceFrame
        title="Salon directory"
        subtitle="Browse every tenant, open the live manager workspace, or suspend access in one place."
      >
        <div className="space-y-4">
          <Skeleton className="h-11 w-full max-w-xl rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-44 rounded-3xl" />
            <Skeleton className="h-44 rounded-3xl" />
          </div>
        </div>
      </AdminWorkspaceFrame>
    );
  }

  return (
    <AdminWorkspaceFrame
      title="Salon directory"
      subtitle="Filter by plan and registration window, assign catalog plans, open the manager workspace, or suspend and delete tenants."
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-2xl border border-zinc-200/80 bg-white/80 p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                disabled={busy}
                onClick={() => {
                  setPage(1);
                  setFilter(f.id);
                }}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                  filter === f.id
                    ? "bg-zinc-900 text-white shadow dark:bg-rose-100 dark:text-zinc-900"
                    : "border border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  className="w-full rounded-2xl border border-zinc-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none ring-zinc-400/30 focus:ring-2 dark:border-zinc-700 dark:bg-zinc-950"
                  placeholder="Search name, slug, owner…"
                  value={searchDraft}
                  onChange={(e) => setSearchDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      setSearch(searchDraft);
                      setPage(1);
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSearch(searchDraft);
                  setPage(1);
                }}
              >
                Search
              </Button>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[120px] flex-1">
                <Label htmlFor="plan_key">Plan key</Label>
                <Input
                  id="plan_key"
                  className="mt-1"
                  placeholder="e.g. starter"
                  value={planKey}
                  onChange={(e) => setPlanKey(e.target.value)}
                />
              </div>
              <div className="min-w-[130px] flex-1">
                <Label htmlFor="cf">Created from</Label>
                <Input id="cf" type="date" className="mt-1" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
              </div>
              <div className="min-w-[130px] flex-1">
                <Label htmlFor="ct">Created to</Label>
                <Input id="ct" type="date" className="mt-1" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setPage(1);
                  void load();
                }}
              >
                Apply filters
              </Button>
            </div>
          </div>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          bKash ledger and bulk approvals live under{" "}
          <Link href="/admin/tools" className="font-semibold text-rose-800 underline-offset-2 hover:underline dark:text-rose-200">
            Tools (bKash)
          </Link>
          .
        </p>

        <ul className="grid gap-4 sm:grid-cols-2">
          {data.data.map((s) => (
            <li key={s.id}>
              <div className="flex h-full flex-col rounded-3xl border border-zinc-200/90 bg-white p-5 shadow-sm transition hover:border-zinc-300 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:border-zinc-600">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-rose-100 to-zinc-100 text-rose-800 dark:from-rose-950 dark:to-zinc-900 dark:text-rose-200">
                    <Store className="h-5 w-5" aria-hidden />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-zinc-900 dark:text-white">{s.name}</p>
                    <p className="font-mono text-xs text-zinc-500">/{s.slug}</p>
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                    s.is_active
                      ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-100"
                      : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                  }`}
                >
                  {s.is_active ? "Live" : "Off"}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">{approvalLabel(s.approval_status)}</span>
                <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">Since {formatWhen(s.created_at)}</span>
                {s.subscription ? (
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    Plan: {s.subscription.plan_key} · {s.subscription.status}
                  </span>
                ) : null}
                {s.owner ? (
                  <span className="rounded-md bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                    {s.owner.name}
                    {s.owner.is_locked ? " · locked" : ""}
                  </span>
                ) : null}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-5">
                <button
                  type="button"
                  onClick={() => openSalonDashboard(s)}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition active:scale-[0.99] dark:bg-rose-100 dark:text-zinc-900"
                >
                  Open salon
                  <ExternalLink className="h-4 w-4 opacity-80" aria-hidden />
                </button>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setAssignPlanId(plans[0]?.id ? String(plans[0].id) : "");
                    setAssignTarget(s);
                  }}
                >
                  <CreditCard className="h-4 w-4" />
                  Plan
                </Button>
                <button
                  type="button"
                  onClick={() => void toggleActive(s)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-zinc-200 px-3 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-100 dark:hover:bg-zinc-800/80"
                  title={s.is_active ? "Suspend salon" : "Activate salon"}
                >
                  {s.is_active ? (
                    <>
                      <PauseCircle className="h-4 w-4" aria-hidden />
                      Suspend
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" aria-hidden />
                      Activate
                    </>
                  )}
                </button>
                <Button type="button" variant="destructive" className="gap-1.5 px-3" onClick={() => setDeleteTarget(s)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
              </div>
            </li>
          ))}
        </ul>

        {data.data.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500 dark:border-zinc-700">
            No salons match this filter.
          </p>
        ) : null}

        {data.last_page > 1 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-100 pt-6 text-sm dark:border-zinc-800">
            <span className="text-zinc-500">
              Page {data.current_page} of {data.last_page} · {data.total} salons
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-600"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= data.last_page}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-xl border border-zinc-200 px-4 py-2 text-sm font-medium disabled:opacity-40 dark:border-zinc-600"
              >
                Next
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete shop permanently?</DialogTitle>
            <DialogDescription>
              This removes {deleteTarget?.name ?? "this shop"} and related tenant data where the database allows cascade.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void removeShop()}>
              Delete shop
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assignTarget)} onOpenChange={(o) => !o && setAssignTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign subscription plan</DialogTitle>
            <DialogDescription>
              Updates the shop subscription to the selected catalog plan (syncs legacy <code className="font-mono">plan_key</code>
              ).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            <Label>Plan</Label>
            <select
              className="h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={assignPlanId}
              onChange={(e) => setAssignPlanId(e.target.value)}
            >
              {plans.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.name} ({p.slug})
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAssignTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitAssignPlan()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminWorkspaceFrame>
  );
}

export function AdminShopsClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
