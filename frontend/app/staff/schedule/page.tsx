import type { Metadata } from "next";
import { StaffScheduleClient } from "./staff-schedule-client";

export const metadata: Metadata = {
  title: "Staff schedule",
};

export default function StaffSchedulePage() {
  return <StaffScheduleClient />;
}
