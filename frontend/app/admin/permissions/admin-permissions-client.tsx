"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { fetchAdminPermissions, formatApiError, putAdminPermissions } from "@/lib/admin-api";

function Body({ token }: { token: string }) {
  const [matrix, setMatrix] = useState<Record<string, Record<string, boolean>> | null>(null);
  const [json, setJson] = useState("{}");

  const load = useCallback(async () => {
    const res = await fetchAdminPermissions(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setMatrix(res.data.matrix);
    setJson(JSON.stringify(res.data.overrides ?? {}, null, 2));
  }, [token]);

  useEffect(() => {
     
    void load();
  }, [load]);

  async function saveOverrides() {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(json) as Record<string, unknown>;
    } catch {
      toast.error("Invalid JSON");
      return;
    }
    const res = await putAdminPermissions(token, parsed);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Permission overrides saved.");
    void load();
  }

  if (!matrix) {
    return (
      <AdminWorkspaceFrame title="Permissions" subtitle="Roles and module access.">
        <Skeleton className="h-64 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  const modules = Object.keys(Object.values(matrix)[0] ?? {});

  return (
    <AdminWorkspaceFrame
      title="Permissions"
      subtitle="Default matrix is read-only below. Persist JSON overrides per role for future enforcement (application code must read `role_permissions`)."
    >
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Built-in role matrix</CardTitle>
          <CardDescription>Authoritative access is enforced by the API and JWT claims; this table documents intent.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <THead>
              <TR>
                <TH>Role</TH>
                {modules.map((m) => (
                  <TH key={m}>{m}</TH>
                ))}
              </TR>
            </THead>
            <TBody>
              {Object.entries(matrix).map(([role, perms]) => (
                <TR key={role}>
                  <TD className="font-medium">{role}</TD>
                  {modules.map((m) => (
                    <TD key={m}>{perms[m] ? "✓" : "—"}</TD>
                  ))}
                </TR>
              ))}
            </TBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-zinc-800 dark:text-zinc-400">Role permission overrides (JSON)</label>
        <Textarea value={json} onChange={(e) => setJson(e.target.value)} className="min-h-[200px] font-mono text-xs" />
        <Button type="button" className="self-start" onClick={() => void saveOverrides()}>
          Save overrides
        </Button>
      </div>
    </AdminWorkspaceFrame>
  );
}

export function AdminPermissionsClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
