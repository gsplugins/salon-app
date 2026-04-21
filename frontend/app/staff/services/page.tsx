import type { Metadata } from "next";
import { StaffServicesClient } from "./staff-services-client";

export const metadata: Metadata = {
  title: "Staff services",
};

export default function StaffServicesPage() {
  return <StaffServicesClient />;
}
