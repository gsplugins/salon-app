import type { Metadata } from "next";
import { StaffPortalRoot } from "@/components/staff/staff-portal-root";

export const metadata: Metadata = {
  title: "Staff portal",
  description: "Appointments, schedule, and earnings for salon staff.",
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return <StaffPortalRoot>{children}</StaffPortalRoot>;
}
