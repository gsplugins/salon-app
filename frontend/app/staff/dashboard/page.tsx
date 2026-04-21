import type { Metadata } from "next";
import { StaffDashboardClient } from "./staff-dashboard-client";

export const metadata: Metadata = {
  title: "Staff home",
};

export default function StaffDashboardPage() {
  return <StaffDashboardClient />;
}
