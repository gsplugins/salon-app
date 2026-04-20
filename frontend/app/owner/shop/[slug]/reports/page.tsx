import type { Metadata } from "next";
import { OwnerReportsClient } from "../../../reports/owner-reports-client";

export const metadata: Metadata = {
  title: "Reports — Shop owner",
};

export default function OwnerShopReportsPage() {
  return <OwnerReportsClient />;
}
