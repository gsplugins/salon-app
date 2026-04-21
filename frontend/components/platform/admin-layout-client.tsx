"use client";

import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminSettingsShell } from "@/components/platform/admin-settings-shell";

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  return <SuperAdminGate>{() => <AdminSettingsShell>{children}</AdminSettingsShell>}</SuperAdminGate>;
}

