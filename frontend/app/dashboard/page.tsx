import type { Metadata } from "next";
import { CustomerDashboardClient } from "./customer-dashboard-client";

export const metadata: Metadata = {
  title: "My dashboard — Salon",
  description: "Appointments and loyalty points.",
};

export default function CustomerDashboardPage() {
  return <CustomerDashboardClient />;
}
