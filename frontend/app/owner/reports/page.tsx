import type { Metadata } from "next";
import { OwnerReportsClient } from "./owner-reports-client";

export const metadata: Metadata = {
  title: "Reports — Owner",
};

export default function OwnerReportsPage() {
  return <OwnerReportsClient />;
}
