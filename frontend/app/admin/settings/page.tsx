import type { Metadata } from "next";
import { AdminSettingsClient } from "./admin-settings-client";

export const metadata: Metadata = {
  title: "Admin — Settings",
};

export default function AdminSettingsPage() {
  return <AdminSettingsClient />;
}
