"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchOwnerReviews, formatApiError, patchOwnerReviewReply, type OwnerReviewRow } from "@/lib/salon-api";

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<OwnerReviewRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchOwnerReviews(token);
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

  async function saveReply(id: number) {
    const text = drafts[id]?.trim() ?? "";
    if (!text) {
      toast.error("Reply cannot be empty.");
      return;
    }
    const res = await patchOwnerReviewReply(token, id, text);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Reply saved.");
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
      <div>
        <h1 className="text-xl font-semibold text-zinc-800 dark:text-white">Reviews</h1>
        <p className="text-sm text-zinc-800 dark:text-zinc-400">Reply to customer feedback.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={MessageSquare} title="No reviews yet" description="Reviews appear after completed visits." />
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold text-zinc-800 dark:text-white">{r.rating}/5</p>
                <p className="text-xs text-zinc-800">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</p>
              </div>
              {r.customer ? (
                <p className="mt-1 text-sm text-zinc-800">Customer: {r.customer.name}</p>
              ) : null}
              {r.staff ? (
                <p className="text-sm text-zinc-800">Staff: {r.staff.name}</p>
              ) : null}
              {r.comment ? <p className="mt-3 text-sm text-zinc-700 dark:text-zinc-300">{r.comment}</p> : null}
              {r.owner_reply ? (
                <p className="mt-3 rounded-lg bg-zinc-50 p-3 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  <span className="font-medium">Your reply: </span>
                  {r.owner_reply}
                </p>
              ) : null}
              <div className="mt-4">
                <textarea
                  value={drafts[r.id] ?? r.owner_reply ?? ""}
                  onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  placeholder="Write a public reply…"
                  rows={3}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                />
                <button
                  type="button"
                  onClick={() => void saveReply(r.id)}
                  className="mt-2 rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
                >
                  Save reply
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function OwnerReviewsClient() {
  return (
    <SalonManagementGate>{(token) => <Body token={token} />}</SalonManagementGate>
  );
}
