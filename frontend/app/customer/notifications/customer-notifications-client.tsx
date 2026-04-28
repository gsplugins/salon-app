"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, CheckCheck } from "lucide-react";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import {
  fetchCustomerNotifications,
  formatApiError,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
  type CustomerNotificationRow,
} from "@/lib/salon-api";
import { Skeleton } from "@/components/ui/skeleton";

export function CustomerNotificationsClient() {
  const token = useSalonAccessToken();
  const [rows, setRows] = useState<CustomerNotificationRow[] | null>(null);
  const [busyAll, setBusyAll] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchCustomerNotifications(token);
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

  async function markRead(id: number) {
    if (!token) return;
    const res = await markCustomerNotificationRead(token, id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setRows((prev) => (prev ?? []).map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function readAll() {
    if (!token) return;
    setBusyAll(true);
    const res = await markAllCustomerNotificationsRead(token);
    setBusyAll(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setRows((prev) => (prev ?? []).map((n) => ({ ...n, is_read: true })));
  }

  if (!token) return null;
  if (rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-28 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Booking confirmation, completion updates, and review requests.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void readAll()}
          disabled={busyAll}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm font-medium dark:border-zinc-700"
        >
          <CheckCheck className="h-4 w-4" />
          {busyAll ? "Saving…" : "Mark all as read"}
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-zinc-300/80 bg-white p-8 text-center dark:border-zinc-700 dark:bg-zinc-900/50">
          <Bell className="mx-auto h-6 w-6 text-zinc-400" />
          <p className="mt-2 text-sm text-zinc-500">No notifications yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {rows.map((n) => {
            const meta = (n.metadata ?? {}) as Record<string, unknown>;
            const wantsReview = meta.next_action === "write_review" && typeof meta.booking_id === "number";
            return (
              <li
                key={n.id}
                className={`rounded-2xl border p-4 ${
                  n.is_read
                    ? "border-zinc-300/90 bg-white text-zinc-900 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-100"
                    : "border-rose-300 bg-rose-50 text-zinc-900 dark:border-rose-800 dark:bg-rose-950/45 dark:text-zinc-100"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">{n.title ?? "Notification"}</p>
                    {n.body ? <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-200">{n.body}</p> : null}
                    {n.created_at ? (
                      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-300">{new Date(n.created_at).toLocaleString()}</p>
                    ) : null}
                  </div>
                  {!n.is_read ? (
                    <button
                      type="button"
                      onClick={() => void markRead(n.id)}
                      className="rounded-lg border border-zinc-300/90 bg-white px-2 py-1 text-xs font-medium text-zinc-800 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
                    >
                      Mark read
                    </button>
                  ) : null}
                </div>
                {wantsReview ? (
                  <Link
                    href="/customer/appointments"
                    className="mt-3 inline-flex rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
                  >
                    Write review
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
