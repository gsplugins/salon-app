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
    <div className="min-h-screen text-slate-100">
      <PublicHeader />
      <main className="mx-auto max-w-lg px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-white">
          {props.shopName ? `Queue — ${props.shopName}` : "Live queue"}
        </h1>
        <p className="mt-2 text-sm text-slate-300">
          Real-time walk-in queue. Check waiting time and join before reaching the shop.
        </p>

        <div className="mt-6 flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium shadow-sm"
          >
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <Link href={`/shops/${shopId}`} className="text-sm font-medium text-blue-300 underline">
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
                className="card-clean flex items-center justify-between p-4"
              >
                <div>
                  <p className="font-medium text-white">#{r.position} · {r.customer_name}</p>
                  <p className="text-xs text-slate-400 capitalize">{r.status.replace("_", " ")}</p>
                  {r.staff ? <p className="text-xs text-slate-400">with {r.staff.name}</p> : null}
                </div>
                <div className="text-right text-sm text-slate-300">
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

        <form onSubmit={join} className="section-wrap mt-10 p-5">
          <h2 className="text-sm font-semibold text-white">Join the queue</h2>
          <label className="mt-3 block text-xs font-medium text-slate-400">
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
              required
            />
          </label>
          <label className="mt-3 block text-xs font-medium text-slate-400">
            Mobile (optional)
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            />
          </label>
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-blue-500 py-2.5 text-sm font-semibold text-white hover:bg-blue-400"
          >
            Join queue now
          </button>
        </form>
      </main>
    </div>
  );
}
