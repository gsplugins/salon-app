"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchSystemUsers,
  formatApiError,
  patchSystemUser,
  type Paginated,
  type SystemUserRow,
} from "@/lib/salon-api";

function Body({ token }: { token: string }) {
  const [data, setData] = useState<Paginated<SystemUserRow> | null>(null);
  const [busy, setBusy] = useState(true);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchSystemUsers(token, { page });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token, page]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load users
    void load();
  }, [load]);

  async function toggleLock(u: SystemUserRow) {
    const res = await patchSystemUser(token, u.id, { is_locked: !u.is_locked });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success(u.is_locked ? "Unlocked." : "Locked.");
    void load();
  }

  if (busy || !data) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-zinc-900 dark:text-white">Users</h1>
      <ul className="space-y-2">
        {data.data.map((u) => (
          <li
            key={u.id}
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <div>
              <p className="font-medium text-zinc-900 dark:text-white">{u.name}</p>
              <p className="text-sm text-zinc-500">
                {u.mobile} · {u.role}
                {u.is_admin ? " · admin" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void toggleLock(u)}
              className="self-start rounded-lg border border-zinc-200 px-3 py-1.5 text-sm dark:border-zinc-600"
            >
              {u.is_locked ? "Unlock" : "Lock"}
            </button>
          </li>
        ))}
      </ul>
      {data.last_page > 1 ? (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            disabled={page >= data.last_page}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border px-3 py-1 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AdminUsersClient() {
  return (
    <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>
  );
}
