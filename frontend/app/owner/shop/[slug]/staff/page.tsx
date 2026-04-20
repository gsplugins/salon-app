import type { Metadata } from "next";
import { OwnerStaffClient } from "../../../staff/owner-staff-client";

export const metadata: Metadata = {
  title: "Staff — Shop owner",
};

export default function OwnerShopStaffPage() {
  return <OwnerStaffClient />;
}
