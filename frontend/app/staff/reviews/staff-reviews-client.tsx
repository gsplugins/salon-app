"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { formatApiError } from "@/lib/auth-api";
import { formatStaffDate } from "@/lib/staff-ui";
import { fetchStaffReviews, type StaffReviewPayload } from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export function StaffReviewsClient() {
  const token = useSalonAccessToken();
  const [data, setData] = useState<StaffReviewPayload | null>(null);
  const [rating, setRating] = useState<number | undefined>(undefined);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchStaffReviews(token, rating != null ? { rating } : undefined);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token, rating]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!token) return null;

  if (!data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-800 dark:text-white">Reviews</h1>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">What guests said about you. Replies are manager-only.</p>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <p className="text-sm text-zinc-800">Average</p>
        <p className="mt-1 flex items-center gap-2 text-3xl font-bold text-zinc-800 dark:text-white">
          {data.average_rating != null ? data.average_rating.toFixed(2) : "—"}
          <Star className="h-7 w-7 fill-amber-400 text-amber-500" />
        </p>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">{data.count} reviews shown</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={rating === undefined ? "default" : "outline"} className="min-h-11" onClick={() => setRating(undefined)}>
          All ratings
        </Button>
        {[5, 4, 3, 2, 1].map((r) => (
          <Button key={r} type="button" variant={rating === r ? "default" : "outline"} className="min-h-11" onClick={() => setRating(r)}>
            {r} stars
          </Button>
        ))}
      </div>

      <ul className="space-y-2">
        {data.reviews.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-800 dark:border-zinc-700">
            No reviews match this filter.
          </li>
        ) : (
          data.reviews.map((rev) => (
            <li key={rev.id} className="rounded-2xl border border-zinc-100 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/40">
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < rev.rating ? "fill-amber-400" : "text-zinc-300 dark:text-zinc-800"}`} />
                ))}
              </div>
              {rev.comment ? <p className="mt-2 text-sm text-zinc-800 dark:text-zinc-200">{rev.comment}</p> : null}
              {rev.created_at ? <p className="mt-2 text-xs text-zinc-800">{formatStaffDate(rev.created_at)}</p> : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
