import type { Metadata } from "next";
import { OwnerStaffClient } from "./owner-staff-client";

export const metadata: Metadata = {
  title: "Staff — Shop owner",
};

export default function OwnerStaffPage() {
  return <OwnerStaffClient />;
}
