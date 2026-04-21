import type { Metadata } from "next";
import { AdminToolsClient } from "./admin-tools-client";

export const metadata: Metadata = {
  title: "Admin — Tools",
};

export default function Page() {
  return <AdminToolsClient />;
}
