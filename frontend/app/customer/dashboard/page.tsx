import type { Metadata } from "next";
import { CustomerHomeClient } from "./customer-home-client";

export const metadata: Metadata = {
  title: "Customer home",
};

export default function CustomerDashboardPage() {
  return <CustomerHomeClient />;
}
