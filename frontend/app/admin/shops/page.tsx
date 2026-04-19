import type { Metadata } from "next";
import { AdminShopsClient } from "../admin-shops-client";

export const metadata: Metadata = {
  title: "Admin — Shops",
};

export default function AdminShopsPage() {
  return <AdminShopsClient />;
}
