"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { fetchMyWaitlist, formatApiError, removeMyWaitlistEntry, type WaitlistRow } from "@/lib/salon-api";

function statusLabel(status: string): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return "unknown";
  return s.replace(/_/g, " ");
}

export function CustomerWaitlistClient() {
  const token = useSalonAccessToken();
  const [rows, setRows] = useState<WaitlistRow[] | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchMyWaitlist(token);
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

  async function remove(id: number) {
    if (!token) return;
    setBusyId(id);
    const res = await removeMyWaitlistEntry(token, id);
    setBusyId(null);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Removed from waitlist.");
    setRows((prev) => (prev ?? []).filter((x) => x.id !== id));
  }

  if (!token) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-800 dark:text-white">My waitlist</h1>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">Track requests you joined when no slots were available.</p>
      </div>

      {rows == null ? (
        <p className="text-sm text-zinc-800">Loading waitlist…</p>
      ) : rows.length === 0 ? (
        <EmptyState icon={Clock3} title="No waitlist entries" description="Join waitlist from booking page when a day has no available slots." />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-zinc-800 dark:text-white">Requested date: {r.preferred_date}</p>
                  <p className="text-xs text-zinc-800">Service #{r.service_id}{r.staff_id != null ? ` · Staff #${r.staff_id}` : " · Any staff"}</p>
                  <p className="mt-1 text-xs capitalize text-zinc-800">Status: {statusLabel(r.status)}</p>
                </div>
                {(r.status === "waiting" || r.status === "notified") && (
                  <Button variant="outline" disabled={busyId === r.id} onClick={() => void remove(r.id)}>
                    {busyId === r.id ? "Removing..." : "Remove"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
