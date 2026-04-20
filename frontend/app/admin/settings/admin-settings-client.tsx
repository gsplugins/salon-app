"use client";

import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { SystemSuperAdmin } from "@/app/app/system-super-admin";

export function AdminSettingsClient() {
  return <SuperAdminGate>{(token) => <SystemSuperAdmin accessToken={token} />}</SuperAdminGate>;
}
