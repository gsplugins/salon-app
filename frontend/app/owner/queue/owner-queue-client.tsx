"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ListOrdered, RefreshCw } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchOwnerQueueManage,
  fetchOwnerWaitlist,
  fetchStaffCatalog,
  formatApiError,
  patchOwnerQueueStatus,
  patchOwnerWaitlist,
  type CatalogStaffRow,
  type OwnerQueueRow,
  type OwnerWaitlistRow,
} from "@/lib/salon-api";

const STATUSES = ["waiting", "in_progress", "done", "cancelled"] as const;

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<OwnerQueueRow[] | null>(null);
  const [waitlistRows, setWaitlistRows] = useState<OwnerWaitlistRow[] | null>(null);
  const [staffRows, setStaffRows] = useState<CatalogStaffRow[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const [queueRes, waitRes, staffRes] = await Promise.all([
      fetchOwnerQueueManage(token),
      fetchOwnerWaitlist(token, { status: "waiting" }),
      fetchStaffCatalog(token)
    ]);
    setBusy(false);
    if (!queueRes.ok) {
      toast.error(formatApiError(queueRes.body));
      setRows([]);
      return;
    }
    if (!waitRes.ok) {
      toast.error(formatApiError(waitRes.body));
      setWaitlistRows([]);
    } else {
      setWaitlistRows(waitRes.data);
    }
    if (staffRes.ok) setStaffRows(staffRes.data.filter((s) => s.is_active));
    setRows(queueRes.data);
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

  async function assignWaitlistToStaff(waitlistId: number, nextStaffId: number | null) {
    const res = await patchOwnerWaitlist(token, waitlistId, {
      staff_id: nextStaffId,
      status: nextStaffId != null ? "notified" : "waiting"
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success(nextStaffId != null ? "Customer assigned to staff." : "Staff assignment removed.");
    void load();
  }

  if (busy || rows === null || waitlistRows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-zinc-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
        <h2 className="text-base font-semibold text-zinc-800 dark:text-white">Waiting list assignments</h2>
        <p className="mt-1 text-xs text-zinc-800">Assign waiting customers to a selected staff member.</p>
        {waitlistRows.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-800">No waiting customers right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {waitlistRows.map((w) => (
              <li
                key={w.id}
                className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-950/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-800 dark:text-white">
                    {w.customer_mobile ?? "Customer"} · {w.service?.name ?? "Service"}
                  </p>
                  <p className="text-xs text-zinc-800">
                    Preferred: {w.preferred_date} · Status: {w.status}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-zinc-200 bg-white px-2 py-2 text-xs dark:border-zinc-700 dark:bg-zinc-950"
                    value={w.staff_id != null ? String(w.staff_id) : ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      void assignWaitlistToStaff(w.id, v ? Number(v) : null);
                    }}
                  >
                    <option value="">Unassigned</option>
                    {staffRows.map((s) => (
                      <option key={s.id} value={String(s.id)}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-800 dark:text-white">Walk-in queue</h1>
          <p className="text-sm text-zinc-800 dark:text-zinc-400">
            Update status as guests are served. Public view:{" "}
            <span className="font-mono text-xs text-zinc-800">/queue/[shopId]</span>
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
                <p className="font-semibold text-zinc-800 dark:text-white">
                  #{r.position} · {r.customer_name}
                </p>
                <p className="text-xs capitalize text-zinc-800">{r.status.replace("_", " ")}</p>
                {r.staff ? <p className="text-xs text-zinc-800">Staff: {r.staff.name}</p> : null}
                {r.estimated_wait_minutes != null ? (
                  <p className="text-xs text-zinc-800">Est. wait ~{r.estimated_wait_minutes} min</p>
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
