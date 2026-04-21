import type { Metadata } from "next";
import { StaffProfileClient } from "./staff-profile-client";

export const metadata: Metadata = {
  title: "Staff profile",
};

export default function StaffProfilePage() {
  return <StaffProfileClient />;
}
