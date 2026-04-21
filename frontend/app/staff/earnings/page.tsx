import type { Metadata } from "next";
import { StaffEarningsClient } from "./staff-earnings-client";

export const metadata: Metadata = {
  title: "Staff earnings",
};

export default function StaffEarningsPage() {
  return <StaffEarningsClient />;
}
