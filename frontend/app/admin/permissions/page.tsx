import type { Metadata } from "next";
import { AdminPermissionsClient } from "./admin-permissions-client";

export const metadata: Metadata = {
  title: "Admin — Permissions",
};

export default function Page() {
  return <AdminPermissionsClient />;
}
