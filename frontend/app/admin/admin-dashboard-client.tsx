"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { LayoutDashboard } from "lucide-react";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchAdminAuditLogs, fetchSystemShops, formatApiError, type AdminAuditLogRow } from "@/lib/salon-api";

function Body({ token }: { token: string }) {
  const [total, setTotal] = useState<number | null>(null);
  const [newShopNotifications, setNewShopNotifications] = useState<AdminAuditLogRow[]>([]);
  const [busy, setBusy] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    const [shopsRes, notificationsRes] = await Promise.all([
      fetchSystemShops(token, { page: 1 }),
      fetchAdminAuditLogs(token, { action: "system.shop.created_by_user", page: 1 })
    ]);
    setBusy(false);
    if (!shopsRes.ok) {
      toast.error(formatApiError(shopsRes.body));
      setTotal(null);
      return;
    }
    if (!notificationsRes.ok) {
      toast.error(formatApiError(notificationsRes.body));
      setNewShopNotifications([]);
    } else {
      setNewShopNotifications(notificationsRes.data.data.slice(0, 5));
    }
    setTotal(shopsRes.data.total);
  }, [token]);

  useEffect(() => {
     
    void load();
  }, [load]);

  if (busy) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Platform overview</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          High-level counts for super admins. Use{" "}
          <Link href="/admin/general" className="font-medium text-rose-800 underline dark:text-rose-200">
            Admin Settings
          </Link>{" "}
          for full shop approvals, payments, and limits.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 text-zinc-500">
            <LayoutDashboard className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Shops on platform</span>
          </div>
          <p className="mt-3 text-4xl font-semibold text-zinc-900 dark:text-white">
            {total != null ? total : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-zinc-200 p-6 dark:border-zinc-700">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Use Shops and Users in the sidebar to approve locations, extend subscriptions, and manage accounts.
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-zinc-900 dark:text-white">New shop signup notifications</h2>
          <Link href="/admin/audit-logs" className="text-xs font-medium text-rose-800 underline dark:text-rose-200">
            View all logs
          </Link>
        </div>
        {newShopNotifications.length === 0 ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No new shop signup notifications yet.</p>
        ) : (
          <div className="space-y-2">
            {newShopNotifications.map((log) => {
              const m = (log.metadata ?? {}) as Record<string, unknown>;
              return (
                <div key={log.id} className="rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-700">
                  <p className="font-medium text-zinc-900 dark:text-white">
                    New shop: {String(m.shop_name ?? "Unnamed")} ({String(m.shop_slug ?? "-")})
                  </p>
                  <p className="text-zinc-600 dark:text-zinc-400">
                    Owner mobile: {String(m.owner_mobile ?? "-")} - {new Date(log.created_at).toLocaleString()}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminDashboardClient() {
  return (
    <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>
  );
}
