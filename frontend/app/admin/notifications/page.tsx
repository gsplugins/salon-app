import type { Metadata } from "next";
import { AdminNotificationsClient } from "./admin-notifications-client";

export const metadata: Metadata = {
  title: "Admin — Notifications",
};

export default function Page() {
  return <AdminNotificationsClient />;
}
