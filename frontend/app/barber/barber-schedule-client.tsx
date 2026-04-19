"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { BarberStaffGate } from "@/components/auth/barber-staff-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchBarberToday, formatApiError, type BookingRow } from "@/lib/salon-api";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function Body({ token }: { token: string }) {
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchBarberToday(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setBookings([]);
      return;
    }
    setBookings(res.data);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load schedule
    void load();
  }, [load]);

  if (busy || bookings === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Today</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Appointments assigned to your staff profile.</p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm font-medium">
          <Link href="/app" className="text-rose-800 underline dark:text-rose-200">
            Full calendar
          </Link>
          <Link href="/owner/queue" className="text-zinc-600 hover:text-rose-800 dark:text-zinc-400">
            Shop queue (owners)
          </Link>
        </div>
      </div>

      {bookings.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No appointments today"
          description="When customers book with you, they will appear here."
        />
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li
              key={b.id}
              className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
            >
              <p className="font-semibold text-zinc-900 dark:text-white">{b.service.name}</p>
              <p className="text-sm text-zinc-500">{formatWhen(b.starts_at)}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {b.customer_name} · {b.customer_mobile}
              </p>
              <p className="mt-1 text-xs capitalize text-zinc-500">{b.status}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BarberScheduleClient() {
  return (
    <BarberStaffGate>{(token) => <Body token={token} />}</BarberStaffGate>
  );
}
