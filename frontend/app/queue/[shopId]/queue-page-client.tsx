"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Clock, RefreshCw, Users } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchPublicQueue, formatApiError, postPublicQueueJoin, type QueueRow } from "@/lib/salon-api";

export function QueuePageClient(props: { shopId: number; shopName?: string }) {
  const { shopId } = props;
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchPublicQueue(shopId);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [shopId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial + shop change
    void load();
  }, [load]);

  useEffect(() => {
    const id = window.setInterval(() => void load(), 15000);
    return () => window.clearInterval(id);
  }, [load]);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Please enter your name.");
      return;
    }
    const res = await postPublicQueueJoin(shopId, {
      customer_name: name.trim(),
      customer_mobile: mobile.trim() || null,
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success(`You're #${res.data.position} in line`);
    setName("");
    setMobile("");
    void load();
  }

  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <PublicHeader />
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          {props.shopName ? `Queue — ${props.shopName}` : "Live queue"}
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Positions refresh every 15 seconds. Join as a walk-in guest.
        </p>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-medium shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link href={`/shops/${shopId}`} className="text-sm font-medium text-rose-800 underline dark:text-rose-200">
            Shop details
          </Link>
        </div>

        {rows === null ? (
          <ul className="mt-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <li key={i}>
                <Skeleton className="h-16 w-full" />
              </li>
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <div className="mt-10">
            <EmptyState
              icon={Users}
              title="No one waiting"
              description="Be the first in line — add your name below for a walk-in spot."
            />
          </div>
        ) : (
          <ul className="mt-8 space-y-3">
            {rows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-white">#{r.position} · {r.customer_name}</p>
                  <p className="text-xs text-zinc-500 capitalize">{r.status.replace("_", " ")}</p>
                  {r.staff ? <p className="text-xs text-zinc-500">with {r.staff.name}</p> : null}
                </div>
                <div className="text-right text-sm text-zinc-600 dark:text-zinc-400">
                  {r.estimated_wait_minutes != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      ~{r.estimated_wait_minutes} min
                    </span>
                  ) : (
                    "—"
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={join} className="mt-10 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Join the queue</h2>
          <label className="mt-3 block text-xs font-medium text-zinc-500">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              required
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-zinc-500">
            Mobile (optional)
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
          </label>
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
          >
            Join
          </button>
        </form>
      </main>
    </div>
  );
}
