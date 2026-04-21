"use client";

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
import { deleteAdminWebhook, fetchAdminWebhooks, formatApiError, postAdminWebhook, type AdminWebhookRow } from "@/lib/admin-api";
import { authJson } from "@/lib/auth-api";

function Body({ token }: { token: string }) {
  const [rows, setRows] = useState<AdminWebhookRow[] | null>(null);
  const [url, setUrl] = useState("");
  const [del, setDel] = useState<number | null>(null);

  const load = useCallback(async () => {
    const res = await fetchAdminWebhooks(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load webhooks
    void load();
  }, [load]);

  async function add() {
    const res = await postAdminWebhook(token, { url, events: ["*"] });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Webhook added.");
    setUrl("");
    void load();
  }

  async function test(id: number) {
    const res = await authJson(`/admin/webhooks/${id}/test`, { method: "POST", accessToken: token });
    if (!res.ok) toast.error(formatApiError(res.body as never));
    else toast.message((res.data as { message?: string }).message ?? "OK");
  }

  async function remove() {
    if (del === null) return;
    const res = await deleteAdminWebhook(token, del);
    if (!res.ok) toast.error(formatApiError(res.body));
    else {
      toast.success("Removed.");
      setDel(null);
      void load();
    }
  }

  if (!rows) {
    return (
      <AdminWorkspaceFrame title="Webhooks" subtitle="Outbound integrations.">
        <Skeleton className="h-32 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  return (
    <AdminWorkspaceFrame
      title="Webhooks"
      subtitle="Register HTTPS endpoints. Test ping is a stub until worker HTTP is wired."
    >
      <div className="mb-6 flex flex-wrap items-end gap-2">
        <div className="min-w-[240px] flex-1">
          <Label>URL</Label>
          <Input className="mt-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/hook" />
        </div>
        <Button type="button" onClick={() => void add()}>
          Add webhook
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>ID</TH>
            <TH>URL</TH>
            <TH>Active</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((w) => (
            <TR key={w.id}>
              <TD>{w.id}</TD>
              <TD className="max-w-[320px] truncate text-xs">{w.url}</TD>
              <TD>{w.is_active ? "yes" : "no"}</TD>
              <TD className="text-right space-x-1">
                <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => void test(w.id)}>
                  Test
                </Button>
                <Button type="button" variant="destructive" className="h-8 px-2 text-xs" onClick={() => setDel(w.id)}>
                  Delete
                </Button>
              </TD>
            </TR>
          ))}
        </TBody>
      </Table>

      <Dialog open={del !== null} onOpenChange={(o) => !o && setDel(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete webhook?</DialogTitle>
            <DialogDescription>This cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDel(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void remove()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminWorkspaceFrame>
  );
}

export function AdminWebhooksClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
