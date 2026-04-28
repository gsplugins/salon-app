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

function parseBdtToCents(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number.parseFloat(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function ExtraProductFields({ row, token, onSaved }: { row: InventoryRow; token: string; onSaved: () => void }) {
  const [sku, setSku] = useState(row.sku ?? "");
  const [unit, setUnit] = useState(row.unit);
  const [low, setLow] = useState(row.low_stock_threshold ?? "");
  const [cost, setCost] = useState(
    row.cost_price_cents != null && row.cost_price_cents > 0 ? String(row.cost_price_cents / 100) : ""
  );
  const [supplier, setSupplier] = useState(row.supplier_notes ?? "");

  useEffect(() => {
    setSku(row.sku ?? "");
    setUnit(row.unit);
    setLow(row.low_stock_threshold ?? "");
    setCost(row.cost_price_cents != null && row.cost_price_cents > 0 ? String(row.cost_price_cents / 100) : "");
    setSupplier(row.supplier_notes ?? "");
  }, [row.id, row.sku, row.unit, row.low_stock_threshold, row.cost_price_cents, row.supplier_notes]);

  async function saveDetails(e: React.FormEvent) {
    e.preventDefault();
    const lowNum = low.trim() === "" ? null : Number.parseFloat(low);
    if (low.trim() !== "" && (!Number.isFinite(lowNum) || (lowNum ?? 0) < 0)) {
      toast.error("Invalid low-stock threshold.");
      return;
    }
    const costCents = parseBdtToCents(cost);
    if (cost.trim() !== "" && costCents == null) {
      toast.error("Invalid unit cost.");
      return;
    }
    const res = await patchOwnerInventory(token, row.id, {
      unit: unit.trim() || "unit",
      low_stock_threshold: lowNum,
      sku: sku.trim() === "" ? null : sku.trim(),
      cost_price_cents: costCents,
      supplier_notes: supplier.trim() === "" ? null : supplier.trim(),
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Product details saved.");
    onSaved();
  }

  return (
    <form onSubmit={saveDetails} className="mt-2 grid gap-2 rounded-lg border border-zinc-100 bg-zinc-50/80 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-950/40 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-zinc-800 dark:text-zinc-400">
        SKU
        <input
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="text-zinc-800 dark:text-zinc-400">
        Unit
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <label className="text-zinc-800 dark:text-zinc-400">
        Low stock at
        <input
          value={low}
          onChange={(e) => setLow(e.target.value)}
          placeholder="optional"
          className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          inputMode="decimal"
        />
      </label>
      <label className="text-zinc-800 dark:text-zinc-400 sm:col-span-2 lg:col-span-1">
        Your cost per {unit || "unit"} (BDT, staff-side COGS hint)
        <input
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="e.g. 120"
          className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          inputMode="decimal"
        />
      </label>
      <label className="sm:col-span-2 text-zinc-800 dark:text-zinc-400">
        Supplier / reorder notes
        <input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          className="mt-1 w-full rounded border border-zinc-200 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
      </label>
      <div className="flex items-end">
        <button
          type="submit"
          className="rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
        >
          Save details
        </button>
      </div>
    </form>
  );
}

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<InventoryRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("1");
  const [unit, setUnit] = useState("unit");
  const [low, setLow] = useState("");
  const [sku, setSku] = useState("");
  const [cost, setCost] = useState("");
  const [supplier, setSupplier] = useState("");

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
     
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const q = Number.parseFloat(qty);
    if (Number.isNaN(q) || q < 0) {
      toast.error("Invalid quantity.");
      return;
    }
    const lowNum = low.trim() === "" ? null : Number.parseFloat(low);
    if (low.trim() !== "" && (!Number.isFinite(lowNum) || (lowNum ?? 0) < 0)) {
      toast.error("Invalid low-stock threshold.");
      return;
    }
    const costCents = parseBdtToCents(cost);
    if (cost.trim() !== "" && costCents == null) {
      toast.error("Invalid unit cost.");
      return;
    }
    const res = await createOwnerInventory(token, {
      name,
      quantity: q,
      unit: unit.trim() || "unit",
      low_stock_threshold: lowNum,
      sku: sku.trim() === "" ? null : sku.trim(),
      cost_price_cents: costCents,
      supplier_notes: supplier.trim() === "" ? null : supplier.trim(),
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Item added.");
    setName("");
    setQty("1");
    setUnit("unit");
    setLow("");
    setSku("");
    setCost("");
    setSupplier("");
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
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-white">Inventory</h1>
        <p className="text-sm text-zinc-800 dark:text-zinc-400">
          Track stock, SKU, and your unit cost (used for staff-side service material estimates).
        </p>
      </div>

      <form
        onSubmit={add}
        className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40"
      >
        <div className="flex flex-wrap gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Product name"
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
          <input
            value={unit}
            onChange={(e) => setUnit(e.target.value)}
            placeholder="unit"
            className="w-24 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <button
            type="submit"
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
          >
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <input
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            placeholder="SKU (optional)"
            className="min-w-[120px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={low}
            onChange={(e) => setLow(e.target.value)}
            placeholder="Low stock alert at (optional)"
            className="w-44 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            inputMode="decimal"
          />
          <input
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="Your cost per unit BDT"
            className="w-40 rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-950"
            inputMode="decimal"
          />
        </div>
        <input
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
          placeholder="Supplier / reorder notes (optional)"
          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
        />
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
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-800 dark:text-white">{r.name}</p>
                <p className="text-sm text-zinc-800">
                  {r.quantity} {r.unit}
                  {r.sku ? ` · SKU ${r.sku}` : ""}
                  {r.low_stock_threshold ? ` · low at ${r.low_stock_threshold}` : ""}
                  {r.cost_price_cents != null && r.cost_price_cents > 0
                    ? ` · cost ${(r.cost_price_cents / 100).toFixed(0)} BDT/${r.unit}`
                    : ""}
                </p>
                <ExtraProductFields key={r.id} row={r} token={token} onSaved={() => void load()} />
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
