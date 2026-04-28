"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { formatApiError } from "@/lib/auth-api";
import { formatStaffDateTime } from "@/lib/staff-ui";
import {
  deleteStaffNotificationsAll,
  fetchStaffNotifications,
  fetchStaffProfile,
  patchStaffNotificationPreferences,
  patchStaffNotificationRead,
  postStaffNotificationsReadAll,
  type StaffNotificationRow,
} from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export function StaffNotificationsClient() {
  const token = useSalonAccessToken();
  const [rows, setRows] = useState<StaffNotificationRow[] | null>(null);
  const [emailOn, setEmailOn] = useState(false);
  const [smsOn, setSmsOn] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const [n, p] = await Promise.all([fetchStaffNotifications(token), fetchStaffProfile(token)]);
    if (!n.ok) {
      toast.error(formatApiError(n.body));
      setRows([]);
    } else setRows(n.data);
    if (p.ok) {
      const s = p.data.portal_settings as { email_alerts?: boolean; sms_alerts?: boolean };
      setEmailOn(Boolean(s?.email_alerts));
      setSmsOn(Boolean(s?.sms_alerts));
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: number) {
    if (!token) return;
    const res = await patchStaffNotificationRead(token, id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    void load();
  }

  async function readAll() {
    if (!token) return;
    const res = await postStaffNotificationsReadAll(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("All marked read.");
    void load();
  }

  async function clearAll() {
    if (!token) return;
    if (!confirm("Delete all notifications? This cannot be undone.")) return;
    const res = await deleteStaffNotificationsAll(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Inbox cleared.");
    void load();
  }

  async function savePrefs(next: { email?: boolean; sms?: boolean }) {
    if (!token) return;
    const res = await patchStaffNotificationPreferences(token, {
      ...(next.email !== undefined ? { email_alerts: next.email } : {}),
      ...(next.sms !== undefined ? { sms_alerts: next.sms } : {}),
    });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Preferences saved.");
    void load();
  }

  if (!token) return null;

  if (rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-800 dark:text-white">Notifications</h1>
          <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">Assignments, cancellations, leave decisions, and manager messages.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void readAll()}>
            Mark all read
          </Button>
          <Button type="button" variant="destructive" className="min-h-11" onClick={() => void clearAll()}>
            Clear all
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950/40">
        <p className="text-sm font-semibold text-zinc-800 dark:text-white">Delivery preferences</p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-800 sm:min-w-[200px]">
            <Label htmlFor="email-alerts" className="text-sm">
              Email alerts
            </Label>
            <Switch
              id="email-alerts"
              checked={emailOn}
              onCheckedChange={(v) => {
                setEmailOn(v);
                void savePrefs({ email: v });
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-100 px-3 py-2 dark:border-zinc-800 sm:min-w-[200px]">
            <Label htmlFor="sms-alerts" className="text-sm">
              SMS alerts
            </Label>
            <Switch
              id="sms-alerts"
              checked={smsOn}
              onCheckedChange={(v) => {
                setSmsOn(v);
                void savePrefs({ sms: v });
              }}
            />
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-800 dark:border-zinc-700">
            You&apos;re all caught up.
          </li>
        ) : (
          rows.map((n) => (
            <li
              key={n.id}
              className={`rounded-2xl border px-4 py-3 text-sm ${
                n.is_read
                  ? "border-zinc-100 bg-white dark:border-zinc-800 dark:bg-zinc-950/30"
                  : "border-rose-200 bg-rose-50/60 dark:border-rose-900 dark:bg-rose-950/20"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-zinc-800 dark:text-white">{n.title ?? n.type}</p>
                  {n.body ? <p className="mt-1 text-zinc-700 dark:text-zinc-300">{n.body}</p> : null}
                  {n.created_at ? <p className="mt-2 text-xs text-zinc-800">{formatStaffDateTime(n.created_at)}</p> : null}
                </div>
                {!n.is_read ? (
                  <Button type="button" variant="outline" className="min-h-10 shrink-0 px-3 py-2 text-xs" onClick={() => void markRead(n.id)}>
                    Mark read
                  </Button>
                ) : null}
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
