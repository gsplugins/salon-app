import type { Metadata } from "next";
import { BarberScheduleClient } from "../barber-schedule-client";

export const metadata: Metadata = {
  title: "Barber — Schedule",
};

export default function BarberSchedulePage() {
  return <BarberScheduleClient />;
}
