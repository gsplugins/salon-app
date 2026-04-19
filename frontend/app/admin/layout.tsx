import { AdminSidebarShell } from "@/components/platform/admin-sidebar-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminSidebarShell>{children}</AdminSidebarShell>;
}
