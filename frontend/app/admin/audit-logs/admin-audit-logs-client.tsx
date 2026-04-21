"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { adminAuditLogsExportUrl, fetchAdminAuditLogs, formatApiError, type AuditLogRow, type Paginated } from "@/lib/admin-api";

function Body({ token }: { token: string }) {
  const [data, setData] = useState<Paginated<AuditLogRow> | null>(null);
  const [page, setPage] = useState(1);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [action, setAction] = useState("");

  const load = useCallback(async () => {
    const res = await fetchAdminAuditLogs(token, { page, from: from || undefined, to: to || undefined, action: action || undefined });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setData(null);
      return;
    }
    setData(res.data);
  }, [token, page, from, to, action]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load audit page
    void load();
  }, [load]);

  async function downloadCsv() {
    const url = adminAuditLogsExportUrl({ from: from || undefined, to: to || undefined });
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "audit-logs.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (!data) {
    return (
      <AdminWorkspaceFrame title="Audit logs" subtitle="Immutable admin actions.">
        <Skeleton className="h-48 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  return (
    <AdminWorkspaceFrame
      title="Audit logs"
      subtitle="Who changed what, from which IP. Export CSV for compliance reviews."
    >
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <Label>Action contains</Label>
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="optional" />
        </div>
        <div className="grid gap-1">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button type="button" onClick={() => void load()}>
          Apply
        </Button>
        <Button type="button" variant="outline" onClick={() => void downloadCsv()}>
          Export CSV
        </Button>
      </div>

      <Table>
        <THead>
          <TR>
            <TH>When</TH>
            <TH>Admin</TH>
            <TH>Action</TH>
            <TH>Target</TH>
            <TH>IP</TH>
          </TR>
        </THead>
        <TBody>
          {data.data.map((r) => (
            <TR key={r.id}>
              <TD className="whitespace-nowrap text-xs">{new Date(r.created_at).toLocaleString()}</TD>
              <TD>{r.admin?.name ?? "—"}</TD>
              <TD className="font-mono text-xs">{r.action}</TD>
              <TD className="text-xs">
                {r.target_type ?? "—"} {r.target_id != null ? `#${r.target_id}` : ""}
              </TD>
              <TD className="font-mono text-xs">{r.ip ?? "—"}</TD>
            </TR>
          ))}
        </TBody>
      </Table>

      {data.last_page > 1 ? (
        <div className="mt-4 flex gap-2">
          <Button type="button" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            Prev
          </Button>
          <Button type="button" variant="outline" disabled={page >= data.last_page} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      ) : null}
    </AdminWorkspaceFrame>
  );
}

export function AdminAuditLogsClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
