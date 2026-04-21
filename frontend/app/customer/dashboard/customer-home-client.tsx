"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Gift } from "lucide-react";
import { formatCustomerWhen } from "@/lib/customer-portal-utils";
import { fetchCustomerAppointments, fetchCustomerLoyalty, formatApiError, type BookingRow, type LoyaltyPayload } from "@/lib/salon-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export function CustomerHomeClient() {
  const token = useSalonAccessToken();
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [loyalty, setLoyalty] = useState<LoyaltyPayload | null>(null);
  const [busy, setBusy] = useState(true);
  const [asOf] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const [a, l] = await Promise.all([fetchCustomerAppointments(token), fetchCustomerLoyalty(token)]);
    setBusy(false);
    if (!a.ok) {
      toast.error(formatApiError(a.body));
      setBookings([]);
    } else setBookings(a.data);
    if (!l.ok) {
      toast.error(formatApiError(l.body));
      setLoyalty({ points: 0, transactions: [] });
    } else setLoyalty(l.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const upcoming =
    bookings?.filter((b) => new Date(b.starts_at) >= asOf && b.status !== "cancelled") ?? [];
  const next = upcoming[0] ?? null;

  if (!token) return null;

  if (busy || bookings === null || loyalty === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3 max-w-sm" />
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Home</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Your next visit and rewards at a glance.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Gift className="h-4 w-4 text-rose-700 dark:text-rose-300" />
              Loyalty balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-zinc-900 dark:text-white">{loyalty.points}</p>
            <p className="mt-1 text-xs text-zinc-500">Points available</p>
            <Button asChild variant="outline" className="mt-3 min-h-11 w-full sm:w-auto">
              <Link href="/customer/loyalty">View activity</Link>
            </Button>
          </CardContent>
        </Card>
        {next ? (
          <Card className="border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Calendar className="h-4 w-4 text-rose-700 dark:text-rose-300" />
                Next booking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="font-medium text-zinc-900 dark:text-white">{next.service.name}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{formatCustomerWhen(next.starts_at)}</p>
              <p className="text-xs text-zinc-500">
                {next.shop?.name ?? "Salon"} · {next.staff.name}
              </p>
              <Button asChild variant="outline" className="mt-3 min-h-11 w-full sm:w-auto">
                <Link href="/customer/appointments">All bookings</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={Calendar}
            title="No upcoming visits"
            description="Browse salons and book your next appointment."
            action={
              <Button asChild className="min-h-11">
                <Link href="/shops">Browse shops</Link>
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
