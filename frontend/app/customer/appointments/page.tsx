import type { Metadata } from "next";
import { CustomerAppointmentsClient } from "./customer-appointments-client";

export const metadata: Metadata = {
  title: "My bookings",
};

export default function CustomerAppointmentsPage() {
  return <CustomerAppointmentsClient />;
}
