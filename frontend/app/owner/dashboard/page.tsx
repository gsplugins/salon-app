import type { Metadata } from "next";
import { OwnerDashboardClient } from "../owner-dashboard-client";

export const metadata: Metadata = {
  title: "Owner dashboard — Salon",
  description: "Revenue and appointment overview for your barbershop locations.",
};

export default function OwnerDashboardPage() {
  return <OwnerDashboardClient />;
}
