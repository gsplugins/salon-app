"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Package, Trash2 } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createOwnerInventory,
  deleteOwnerInventory,
  fetchOwnerInventory,
  formatApiError,
  patchOwnerInventory,
  type InventoryRow,
} from "@/lib/salon-api";

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<InventoryRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchOwnerInventory(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load inventory
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const q = Number.parseFloat(qty);
    if (Number.isNaN(q) || q < 0) {
      toast.error("Invalid quantity.");
      return;
    }
    const res = await createOwnerInventory(token, { name, quantity: q });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Item added.");
    setName("");
    setQty("1");
    void load();
  }

  async function bump(row: InventoryRow, delta: number) {
    const next = Number.parseFloat(row.quantity) + delta;
    if (next < 0) return;
    const res = await patchOwnerInventory(token, row.id, { quantity: next });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    void load();
  }

  async function remove(id: number) {
    const res = await deleteOwnerInventory(token, id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Removed.");
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
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Inventory</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Track stock for your shop.</p>
      </div>

      <form onSubmit={add} className="flex flex-wrap gap-2 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          required
          className="min-w-[160px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <input
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          className="w-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
        <button
          type="submit"
          className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          Add
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Package} title="No stock lines" description="Add products or supplies you track." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">{r.name}</p>
                <p className="text-sm text-zinc-500">
                  {r.quantity} {r.unit}
                  {r.low_stock_threshold ? ` · low at ${r.low_stock_threshold}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void bump(r, -1)}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-600"
                >
                  −1
                </button>
                <button
                  type="button"
                  onClick={() => void bump(r, 1)}
                  className="rounded-lg border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-600"
                >
                  +1
                </button>
                <button
                  type="button"
                  onClick={() => void remove(r.id)}
                  className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                  aria-label="Delete"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerInventoryClient() {
  return (
    <SalonManagementGate>{(token) => <Body token={token} />}</SalonManagementGate>
  );
}
