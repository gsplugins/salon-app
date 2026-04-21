import type { Metadata } from "next";
import { AdminGeneralClient } from "./admin-general-client";

export const metadata: Metadata = {
  title: "Admin — General",
};

export default function AdminGeneralPage() {
  return <AdminGeneralClient />;
}
