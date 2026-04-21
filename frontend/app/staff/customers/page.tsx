import type { Metadata } from "next";
import { StaffCustomersClient } from "./staff-customers-client";

export const metadata: Metadata = {
  title: "Staff customers",
};

export default function StaffCustomersPage() {
  return <StaffCustomersClient />;
}
