"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import { formatCustomerWhen } from "@/lib/customer-portal-utils";
import { fetchCustomerLoyalty, formatApiError, type LoyaltyPayload } from "@/lib/salon-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CustomerLoyaltyClient() {
  const token = useSalonAccessToken();
  const [loyalty, setLoyalty] = useState<LoyaltyPayload | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const res = await fetchCustomerLoyalty(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setLoyalty({ points: 0, transactions: [] });
      return;
    }
    setLoyalty(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;

  if (busy || loyalty === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Loyalty</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Points balance and recent activity.</p>
      </div>

      <Card className="border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Gift className="h-5 w-5 text-rose-700 dark:text-rose-300" />
            Current balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold text-zinc-900 dark:text-white">{loyalty.points}</p>
          <p className="mt-1 text-xs text-zinc-500">Points</p>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Transactions</h2>
        {loyalty.transactions.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No transactions yet.</p>
        ) : (
          <ul className="mt-3 space-y-2 rounded-2xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
            {loyalty.transactions.map((t) => (
              <li key={t.id} className="flex justify-between gap-4 border-b border-zinc-100 py-2 text-sm last:border-0 dark:border-zinc-800">
                <div>
                  <p className="text-zinc-800 dark:text-zinc-200">{t.description ?? t.type}</p>
                  {t.created_at ? <p className="text-xs text-zinc-500">{formatCustomerWhen(t.created_at)}</p> : null}
                </div>
                <span className="shrink-0 font-semibold text-zinc-900 dark:text-white">
                  {t.points > 0 ? "+" : ""}
                  {t.points}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
