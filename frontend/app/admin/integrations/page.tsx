import type { Metadata } from "next";
import { AdminIntegrationsClient } from "./admin-integrations-client";

export const metadata: Metadata = {
  title: "Admin — Integrations",
};

export default function Page() {
  return <AdminIntegrationsClient />;
}
