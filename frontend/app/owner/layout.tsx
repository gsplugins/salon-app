import { OwnerSidebarShell } from "@/components/platform/owner-sidebar-shell";

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return <OwnerSidebarShell>{children}</OwnerSidebarShell>;
}
