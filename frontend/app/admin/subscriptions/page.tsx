import type { Metadata } from "next";
import { AdminSubscriptionsClient } from "./admin-subscriptions-client";

export const metadata: Metadata = {
  title: "Admin — Subscriptions",
};

export default function Page() {
  return <AdminSubscriptionsClient />;
}
