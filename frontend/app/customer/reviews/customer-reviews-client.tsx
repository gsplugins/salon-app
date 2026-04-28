"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageSquare, Star, Store } from "lucide-react";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { fetchCustomerReviews, formatApiError, type CustomerReviewRow } from "@/lib/salon-api";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomerReviewsClient() {
  const token = useSalonAccessToken();
  const [rows, setRows] = useState<CustomerReviewRow[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchCustomerReviews(token);
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

  if (!token) return null;
  if (rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-800 dark:text-white">My reviews</h1>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">
          Reviews you submitted after completed services, with barber and shop info.
        </p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No reviews yet"
          description="Complete a service, then you can rate your barber from appointments."
          action={
            <Link
              href="/customer/appointments"
              className="inline-flex min-h-11 items-center rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
            >
              Go to appointments
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((r) => (
            <li key={r.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < r.rating ? "fill-amber-400" : "text-zinc-300 dark:text-zinc-800"}`} />
                  ))}
                  <span className="ml-1 text-sm font-medium">{r.rating}/5</span>
                </p>
                <p className="text-xs text-zinc-800">{r.created_at ? new Date(r.created_at).toLocaleString() : ""}</p>
              </div>

              <div className="mt-2 space-y-1 text-sm text-zinc-800 dark:text-zinc-300">
                {r.staff_name ? <p>Barber: {r.staff_name}</p> : null}
                {r.shop ? (
                  <p className="inline-flex items-center gap-1">
                    <Store className="h-4 w-4" />
                    Shop: {r.shop.name}
                  </p>
                ) : null}
              </div>

              {r.comment ? <p className="mt-3 text-sm text-zinc-800 dark:text-zinc-200">{r.comment}</p> : null}

              {r.shop ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link
                    href={`/shops/${r.shop.id}`}
                    className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium dark:border-zinc-700"
                  >
                    View shop
                  </Link>
                  {r.shop.slug ? (
                    <Link
                      href={`/s/${r.shop.slug}/book`}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
                    >
                      Book again
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
