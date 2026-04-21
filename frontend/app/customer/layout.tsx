import type { Metadata } from "next";
import { CustomerPortalRoot } from "@/components/customer/customer-portal-root";

export const metadata: Metadata = {
  title: "Customer portal",
  description: "Your appointments, loyalty, and profile.",
};

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return <CustomerPortalRoot>{children}</CustomerPortalRoot>;
}
