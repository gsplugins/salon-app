"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ListOrdered, RefreshCw } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchOwnerQueueManage,
  formatApiError,
  patchOwnerQueueStatus,
  type OwnerQueueRow,
} from "@/lib/salon-api";

const STATUSES = ["waiting", "in_progress", "done", "cancelled"] as const;

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<OwnerQueueRow[] | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchOwnerQueueManage(token);
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

  async function setStatus(id: number, status: (typeof STATUSES)[number]) {
    const res = await patchOwnerQueueStatus(token, id, status);
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
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Walk-in queue</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Update status as guests are served. Public view:{" "}
            <span className="font-mono text-xs text-zinc-500">/queue/[shopId]</span>
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Queue is empty"
          description="When customers join from the public queue page, they appear here."
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-zinc-900 dark:text-white">
                  #{r.position} · {r.customer_name}
                </p>
                <p className="text-xs capitalize text-zinc-500">{r.status.replace("_", " ")}</p>
                {r.staff ? <p className="text-xs text-zinc-500">Staff: {r.staff.name}</p> : null}
                {r.estimated_wait_minutes != null ? (
                  <p className="text-xs text-zinc-500">Est. wait ~{r.estimated_wait_minutes} min</p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void setStatus(r.id, s)}
                    disabled={r.status === s}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium capitalize disabled:opacity-40 ${
                      r.status === s
                        ? "border-rose-600 bg-rose-100 text-rose-950 dark:border-rose-500 dark:bg-rose-950/50 dark:text-rose-100"
                        : "border-zinc-200 dark:border-zinc-600"
                    }`}
                  >
                    {s.replace("_", " ")}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerQueueClient() {
  return (
    <SalonManagementGate>{(token) => <Body token={token} />}</SalonManagementGate>
  );
}
