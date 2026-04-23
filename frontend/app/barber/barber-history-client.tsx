"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { History } from "lucide-react";
import { BarberStaffGate } from "@/components/auth/barber-staff-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBarberHistory, formatApiError, type BookingRow } from "@/lib/salon-api";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<BookingRow[] | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchBarberHistory(token);
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
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">History</h1>
      {rows.length === 0 ? (
        <EmptyState icon={History} title="No past appointments" description="Completed visits will list here." />
      ) : (
        <ul className="space-y-2">
          {rows.map((b) => (
            <li
              key={b.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 text-sm dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <p className="font-medium text-zinc-900 dark:text-white">{b.service.name}</p>
              <p className="text-zinc-500">{formatWhen(b.starts_at)}</p>
              <p className="text-zinc-600 dark:text-zinc-400">{b.shop?.name ?? "Shop"}</p>
              <p className="mt-1 text-xs capitalize text-zinc-500">{b.status}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BarberHistoryClient() {
  return (
    <BarberStaffGate>{(token) => <Body token={token} />}</BarberStaffGate>
  );
}
