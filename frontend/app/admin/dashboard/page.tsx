import type { Metadata } from "next";
import { AdminDashboardClient } from "../admin-dashboard-client";

export const metadata: Metadata = {
  title: "Admin dashboard",
};

export default function AdminDashboardPage() {
  return <AdminDashboardClient />;
}
