import type { Metadata } from "next";
import { AdminWebhooksClient } from "./admin-webhooks-client";

export const metadata: Metadata = {
  title: "Admin — Webhooks",
};

export default function Page() {
  return <AdminWebhooksClient />;
}
