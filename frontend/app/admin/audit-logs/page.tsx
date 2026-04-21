import type { Metadata } from "next";
import { AdminAuditLogsClient } from "./admin-audit-logs-client";

export const metadata: Metadata = {
  title: "Admin — Audit logs",
};

export default function Page() {
  return <AdminAuditLogsClient />;
}
