import type { Metadata } from "next";
import { StaffAppointmentsClient } from "./staff-appointments-client";

export const metadata: Metadata = {
  title: "Staff appointments",
};

export default function StaffAppointmentsPage() {
  return <StaffAppointmentsClient />;
}
