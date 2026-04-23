"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { deleteAdminUser, formatApiError, postImpersonateUser } from "@/lib/admin-api";
import { broadcastSalonAuthChange } from "@/lib/auth-events";
import { getPrimaryDashboardPath } from "@/lib/auth-session";
import { fetchAuthMe } from "@/lib/auth-api";
import { fetchSystemUsers, patchSystemUser, type Paginated, type SystemUserRow } from "@/lib/salon-api";

const LS_ACCESS = "salon_access_token";
const LS_REFRESH = "salon_refresh_token";

function Body({ token }: { token: string }) {
  const router = useRouter();
  const [data, setData] = useState<Paginated<SystemUserRow> | null>(null);
  const [busy, setBusy] = useState(true);
  const [page, setPage] = useState(1);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState<"" | "active" | "locked">("");
  const [deleteTarget, setDeleteTarget] = useState<SystemUserRow | null>(null);
  const [impersonateTarget, setImpersonateTarget] = useState<SystemUserRow | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const res = await fetchSystemUsers(token, {
      page,
      search: search || undefined,
      role: role || undefined,
      status: status || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token, page, search, role, status]);

  useEffect(() => {
     
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

  async function confirmDelete() {
    if (!deleteTarget) return;
    const res = await deleteAdminUser(token, deleteTarget.id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("User deleted.");
    setDeleteTarget(null);
    void load();
  }

  async function confirmImpersonate() {
    if (!impersonateTarget) return;
    const res = await postImpersonateUser(token, impersonateTarget.id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    localStorage.setItem(LS_ACCESS, res.data.access_token);
    localStorage.setItem(LS_REFRESH, res.data.refresh_token);
    broadcastSalonAuthChange();
    const me = await fetchAuthMe(res.data.access_token);
    setImpersonateTarget(null);
    toast.success("Session switched.");
    if (me.ok) {
      router.push(getPrimaryDashboardPath(me.data));
    } else {
      router.push("/app");
    }
  }

  if (busy || !data) {
    return (
      <AdminWorkspaceFrame title="Users" subtitle="Search, lock, impersonate, or remove accounts.">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  return (
    <AdminWorkspaceFrame
      title="Users"
      subtitle="Search and filter by role or lock state. Impersonation issues fresh JWTs for the target user (super admin safeguard: cannot impersonate another super admin)."
    >
      <div className="mb-4 flex flex-col flex-wrap gap-3 lg:flex-row lg:items-end">
        <div className="flex min-w-[200px] flex-1 flex-wrap gap-2">
          <Input
            placeholder="Search name or mobile…"
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setSearch(searchDraft);
                setPage(1);
              }
            }}
          />
          <Button
            type="button"
            onClick={() => {
              setSearch(searchDraft);
              setPage(1);
            }}
          >
            Search
          </Button>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="grid gap-1">
            <Label>Role</Label>
            <select
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={role}
              onChange={(e) => {
                setRole(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Any</option>
              <option value="customer">customer</option>
              <option value="shop_owner">shop_owner</option>
              <option value="manager">manager</option>
              <option value="barber">barber</option>
              <option value="super_admin">super_admin</option>
            </select>
          </div>
          <div className="grid gap-1">
            <Label>Status</Label>
            <select
              className="h-10 rounded-xl border border-zinc-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "" | "active" | "locked");
                setPage(1);
              }}
            >
              <option value="">Any</option>
              <option value="active">Active (unlocked)</option>
              <option value="locked">Locked</option>
            </select>
          </div>
        </div>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>User</TH>
            <TH>Role</TH>
            <TH>Status</TH>
            <TH>Joined</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {data.data.map((u) => (
            <TR key={u.id}>
              <TD>
                <div className="font-medium">{u.name}</div>
                <div className="text-xs text-zinc-500">{u.mobile}</div>
              </TD>
              <TD className="text-xs">{u.role}</TD>
              <TD>{u.is_locked ? "Locked" : "Active"}</TD>
              <TD className="text-xs whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</TD>
              <TD className="text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => void toggleLock(u)}>
                    {u.is_locked ? "Unlock" : "Lock"}
                  </Button>
                  {u.role !== "super_admin" ? (
                    <Button type="button" variant="ghost" className="h-8 px-2 text-xs" onClick={() => setImpersonateTarget(u)}>
                      Impersonate
                    </Button>
                  ) : null}
                  {u.role !== "super_admin" ? (
                    <Button type="button" variant="destructive" className="h-8 px-2 text-xs" onClick={() => setDeleteTarget(u)}>
                      Delete
                    </Button>
                  ) : null}
                </div>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {data.last_page > 1 ? (
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={page >= data.last_page}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}

      <Dialog open={Boolean(deleteTarget)} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete user?</DialogTitle>
            <DialogDescription>
              Soft-deletes {deleteTarget?.name}. Blocked if they still own shops. Super admins cannot be removed here.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmDelete()}>
              Delete user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(impersonateTarget)} onOpenChange={(o) => !o && setImpersonateTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impersonate user?</DialogTitle>
            <DialogDescription>
              Your browser session will switch to {impersonateTarget?.name}. You can sign out and sign back in as super
              admin to restore access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setImpersonateTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void confirmImpersonate()}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminWorkspaceFrame>
  );
}

export function AdminUsersClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
