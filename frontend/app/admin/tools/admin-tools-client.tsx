"use client";

import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { SystemSuperAdmin } from "@/app/app/system-super-admin";

export function AdminToolsClient() {
  return (
    <SuperAdminGate>
      {(token) => (
        <AdminWorkspaceFrame
          title="Operator tools"
          subtitle="Manual bKash ledger, subscription extensions, approvals, and deep shop edits (legacy super-admin console)."
        >
          <SystemSuperAdmin accessToken={token} />
        </AdminWorkspaceFrame>
      )}
    </SuperAdminGate>
  );
}
