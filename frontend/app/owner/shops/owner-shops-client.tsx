"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Store } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { createOwnerBranch, fetchOwnerBranches, formatApiError, type BranchRow } from "@/lib/salon-api";

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<BranchRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchOwnerBranches(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load branches
    void load();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await createOwnerBranch(token, { name, slug });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Branch created.");
    setName("");
    setSlug("");
    setOpen(false);
    void load();
  }

  if (busy || rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Branches</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Locations tied to your account.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          <Plus className="h-4 w-4" />
          Add branch
        </button>
      </div>

      {open ? (
        <form onSubmit={submit} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">New branch</h2>
          <label className="mt-3 block text-xs font-medium text-zinc-500">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-zinc-500">
            Slug (lowercase, hyphens)
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button
            type="submit"
            className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
          >
            Create
          </button>
        </form>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No branches yet"
          description="Create your first branch to manage multiple locations."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((b) => (
            <li
              key={b.id}
              className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <p className="font-semibold text-zinc-900 dark:text-white">{b.name}</p>
              <p className="text-sm text-zinc-500">{b.slug}</p>
              {b.parent_shop_id ? (
                <p className="mt-2 text-xs text-zinc-500">Branch of #{b.parent_shop_id}</p>
              ) : (
                <p className="mt-2 text-xs text-zinc-500">Primary location</p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerShopsClient() {
  return (
    <SalonManagementGate>{(token) => <Body token={token} />}</SalonManagementGate>
  );
}
