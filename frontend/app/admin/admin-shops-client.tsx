"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSystemShops,
  formatApiError,
  patchSystemShop,
  type Paginated,
  type SystemShopFilter,
  type SystemShopRow,
} from "@/lib/salon-api";

const FILTERS: { id: SystemShopFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "unpaid", label: "Unpaid" },
  { id: "expired", label: "Expired" },
  { id: "locked", label: "Locked" },
];

function Body({ token }: { token: string }) {
  const [filter, setFilter] = useState<SystemShopFilter>("all");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<SystemShopRow> | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchSystemShops(token, { filter, page });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token, filter, page]);

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
    toast.success(row.is_active ? "Suspended." : "Activated.");
    void load();
  }

  if (busy || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Shops</h1>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => {
              setPage(1);
              setFilter(f.id);
            }}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === f.id
                ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-900"
                : "border border-zinc-200 dark:border-zinc-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {data.data.map((s) => (
          <li
            key={s.id}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div>
              <p className="font-semibold text-zinc-900 dark:text-white">{s.name}</p>
              <p className="text-sm text-zinc-500">{s.slug}</p>
              {s.owner ? (
                <p className="text-xs text-zinc-500">
                  Owner: {s.owner.name} ({s.owner.mobile}) {s.owner.is_locked ? "· locked" : ""}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => void toggleActive(s)}
              className="self-start rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              {s.is_active ? "Suspend" : "Activate"}
            </button>
          </li>
        ))}
      </ul>

      {data.last_page > 1 ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= data.last_page}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminShopsClient() {
  return (
    <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>
  );
}
