import type { Metadata } from "next";
import { AdminBillingClient } from "./admin-billing-client";

export const metadata: Metadata = {
  title: "Admin — Billing",
};

export default function Page() {
  return <AdminBillingClient />;
}
