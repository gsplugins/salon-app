import type { Metadata } from "next";
import { StaffAvailabilityClient } from "./staff-availability-client";

export const metadata: Metadata = {
  title: "Staff availability",
};

export default function StaffAvailabilityPage() {
  return <StaffAvailabilityClient />;
}
