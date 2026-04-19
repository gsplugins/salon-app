"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Scissors } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  createServiceCatalog,
  fetchServicesCatalog,
  formatApiError,
  updateServiceCatalog,
  type CatalogServiceRow,
} from "@/lib/salon-api";

function formatMoney(cents: number | null): string {
  if (cents == null) return "—";
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "BDT", minimumFractionDigits: 0 }).format(
    cents / 100
  );
}

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<CatalogServiceRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [name, setName] = useState("");
  const [duration, setDuration] = useState(30);
  const [price, setPrice] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchServicesCatalog(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load services
    void load();
  }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const priceCents = price.trim() === "" ? null : Math.round(Number.parseFloat(price) * 100);
    const res = await createServiceCatalog(token, {
      name,
      duration_minutes: duration,
      price_cents: priceCents,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Service created.");
    setName("");
    setDuration(30);
    setPrice("");
    void load();
  }

  async function toggle(row: CatalogServiceRow) {
    const res = await updateServiceCatalog(token, row.id, { is_active: !row.is_active });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Updated.");
    void load();
  }

  if (busy || rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Services &amp; pricing</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Catalog for your primary shop location.</p>
      </div>

      <form onSubmit={add} className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Add service</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            required
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            type="number"
            min={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (major units)"
            className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <button
          type="submit"
          className="mt-4 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
        >
          Save
        </button>
      </form>

      {rows.length === 0 ? (
        <EmptyState icon={Scissors} title="No services" description="Create services customers can book online." />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col justify-between gap-2 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <div>
                <p className="font-medium text-zinc-900 dark:text-white">{r.name}</p>
                <p className="text-sm text-zinc-500">
                  {r.duration_minutes} min · {formatMoney(r.price_cents)}{" "}
                  {r.is_active ? "" : "(inactive)"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void toggle(r)}
                className="self-start rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-600"
              >
                {r.is_active ? "Deactivate" : "Activate"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerServicesClient() {
  return (
    <SalonManagementGate>{(token) => <Body token={token} />}</SalonManagementGate>
  );
}
