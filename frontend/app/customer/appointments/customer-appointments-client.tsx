"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar } from "lucide-react";
import { formatCustomerWhen } from "@/lib/customer-portal-utils";
import {
  fetchCustomerAppointments,
  formatApiError,
  patchCustomerBooking,
  type BookingRow,
} from "@/lib/salon-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";

export function CustomerAppointmentsClient() {
  const token = useSalonAccessToken();
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [asOf] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const res = await fetchCustomerAppointments(token);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setBookings([]);
      return;
    }
    setBookings(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelBooking(id: number) {
    if (!token) return;
    if (!confirm("Cancel this appointment? The salon will see it as cancelled.")) return;
    setCancellingId(id);
    const res = await patchCustomerBooking(token, id, { status: "cancelled" });
    setCancellingId(null);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Booking cancelled.");
    void load();
  }

  async function markCompleted(id: number) {
    if (!token) return;
    if (!confirm("Mark this visit as completed?")) return;
    setCancellingId(id);
    const res = await patchCustomerBooking(token, id, { status: "completed" });
    setCancellingId(null);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Marked completed.");
    void load();
  }

  function canMarkCompleted(b: BookingRow): boolean {
    if (b.status !== "confirmed") return false;
    return new Date(b.starts_at) <= new Date();
  }

  if (!token) return null;

  if (busy || bookings === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const upcoming = bookings.filter((b) => new Date(b.starts_at) >= asOf && b.status !== "cancelled");
  const past = bookings.filter((b) => new Date(b.starts_at) < asOf || b.status === "cancelled");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Bookings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Upcoming and past appointments.</p>
      </div>

      <section aria-labelledby="up-heading">
        <h2 id="up-heading" className="text-lg font-semibold text-zinc-900 dark:text-white">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Calendar}
              title="No upcoming visits"
              description="Book a shop from the directory."
              action={
                <Button asChild className="min-h-11">
                  <Link href="/shops">Browse shops</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((b) => (
              <li key={b.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                <p className="font-medium text-zinc-900 dark:text-white">{b.service.name}</p>
                <p className="text-sm text-zinc-500">{formatCustomerWhen(b.starts_at)}</p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {b.shop?.name ?? "Shop"} · {b.staff.name}
                </p>
                <p className="mt-1 text-xs capitalize text-zinc-500">{b.status}</p>
                {(b.status === "pending" || b.status === "confirmed") && b.shop?.slug ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={`/s/${b.shop.slug}/book`}
                      className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
                    >
                      Book again
                    </Link>
                    {canMarkCompleted(b) ? (
                      <button
                        type="button"
                        disabled={cancellingId === b.id}
                        onClick={() => void markCompleted(b.id)}
                        className="inline-flex min-h-11 items-center rounded-full border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
                      >
                        {cancellingId === b.id ? "Saving…" : "Mark completed"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      disabled={cancellingId === b.id}
                      onClick={() => void cancelBooking(b.id)}
                      className="inline-flex min-h-11 items-center rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
                    >
                      {cancellingId === b.id ? "Cancelling…" : "Cancel booking"}
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="past-heading">
        <h2 id="past-heading" className="text-lg font-semibold text-zinc-900 dark:text-white">
          Past
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No past appointments.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {past.slice(0, 40).map((b) => (
              <li
                key={b.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 opacity-90 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <p className="font-medium text-zinc-900 dark:text-white">{b.service.name}</p>
                <p className="text-sm text-zinc-500">{formatCustomerWhen(b.starts_at)}</p>
                <p className="text-xs capitalize text-zinc-500">{b.status}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
