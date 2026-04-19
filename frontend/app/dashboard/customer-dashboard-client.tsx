"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Gift } from "lucide-react";
import { PublicHeader } from "@/components/public-header";
import { CustomerPortalGate } from "@/components/auth/customer-portal-gate";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchCustomerAppointments,
  fetchCustomerLoyalty,
  formatApiError,
  patchCustomerBooking,
  type BookingRow,
  type LoyaltyPayload,
} from "@/lib/salon-api";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso)
  );
}

function DashboardBody({ accessToken }: { accessToken: string }) {
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [asOf] = useState(() => new Date());

  const load = useCallback(async () => {
    setBusy(true);
    const [a, l] = await Promise.all([
      fetchCustomerAppointments(accessToken),
      fetchCustomerLoyalty(accessToken),
    ]);
    setBusy(false);
    if (!a.ok) {
      toast.error(formatApiError(a.body));
      setBookings([]);
    } else setBookings(a.data);
    if (!l.ok) {
      toast.error(formatApiError(l.body));
      setLoyalty({ points: 0, transactions: [] });
    } else setLoyalty(l.data);
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load dashboard data
    void load();
  }, [load]);

  async function cancelBooking(id: number) {
    if (!confirm("Cancel this appointment? The salon will see it as cancelled.")) return;
    setCancellingId(id);
    const res = await patchCustomerBooking(accessToken, id, { status: "cancelled" });
    setCancellingId(null);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Booking cancelled.");
    void load();
  }

  const upcoming =
    bookings?.filter((b) => new Date(b.starts_at) >= asOf && b.status !== "cancelled") ?? [];
  const past =
    bookings?.filter((b) => new Date(b.starts_at) < asOf || b.status === "cancelled") ?? [];

  return (
    <div className="min-h-screen bg-[#faf8f6] text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">My dashboard</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Signed-in customers see appointments and loyalty activity.
        </p>

        {busy || bookings === null || loyalty === null ? (
          <div className="mt-8 space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <section className="mt-8 rounded-2xl border border-rose-100/80 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-100">
                  <Gift className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-500">Loyalty points</p>
                  <p className="text-2xl font-semibold text-zinc-900 dark:text-white">{loyalty.points}</p>
                </div>
              </div>
              {loyalty.transactions.length > 0 ? (
                <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm dark:border-zinc-800">
                  {loyalty.transactions.slice(0, 8).map((t) => (
                    <li key={t.id} className="flex justify-between gap-4 text-zinc-600 dark:text-zinc-400">
                      <span>{t.description ?? t.type}</span>
                      <span className="font-medium text-zinc-900 dark:text-white">{t.points > 0 ? "+" : ""}{t.points}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">No transactions yet.</p>
              )}
            </section>

            <section className="mt-10" aria-labelledby="upcoming-heading">
              <h2 id="upcoming-heading" className="text-lg font-semibold text-zinc-900 dark:text-white">
                Upcoming
              </h2>
              {upcoming.length === 0 ? (
                <div className="mt-4">
                  <EmptyState
                    icon={Calendar}
                    title="No upcoming visits"
                    description="Book a shop from the directory to see appointments here."
                    action={
                      <Link
                        href="/shops"
                        className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
                      >
                        Browse shops
                      </Link>
                    }
                  />
                </div>
              ) : (
                <ul className="mt-4 space-y-3">
                  {upcoming.map((b) => (
                    <li
                      key={b.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <p className="font-medium text-zinc-900 dark:text-white">{b.service.name}</p>
                      <p className="text-sm text-zinc-500">{formatWhen(b.starts_at)}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {b.shop?.name ?? "Shop"} · {b.staff.name}
                      </p>
                      <p className="mt-1 text-xs capitalize text-zinc-500">{b.status}</p>
                      {(b.status === "pending" || b.status === "confirmed") && b.shop?.slug ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Link
                            href={`/s/${b.shop.slug}/book`}
                            className="inline-flex rounded-full border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-200 dark:hover:bg-zinc-800"
                          >
                            Book again
                          </Link>
                          <button
                            type="button"
                            disabled={cancellingId === b.id}
                            onClick={() => void cancelBooking(b.id)}
                            className="inline-flex rounded-full bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
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

            <section className="mt-10" aria-labelledby="past-heading">
              <h2 id="past-heading" className="text-lg font-semibold text-zinc-900 dark:text-white">
                Past
              </h2>
              {past.length === 0 ? (
                <p className="mt-3 text-sm text-zinc-500">No past appointments.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {past.slice(0, 20).map((b) => (
                    <li
                      key={b.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4 opacity-90 dark:border-zinc-800 dark:bg-zinc-900/50"
                    >
                      <p className="font-medium text-zinc-900 dark:text-white">{b.service.name}</p>
                      <p className="text-sm text-zinc-500">{formatWhen(b.starts_at)}</p>
                      <p className="text-xs capitalize text-zinc-500">{b.status}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export function CustomerDashboardClient() {
  return (
    <CustomerPortalGate>{(token) => <DashboardBody accessToken={token} />}</CustomerPortalGate>
  );
}
