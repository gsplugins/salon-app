import type { Metadata } from "next";
import { StaffNotificationsClient } from "./staff-notifications-client";

export const metadata: Metadata = {
  title: "Staff notifications",
};

export default function StaffNotificationsPage() {
  return <StaffNotificationsClient />;
}
