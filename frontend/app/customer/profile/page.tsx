import type { Metadata } from "next";
import { CustomerProfileClient } from "./customer-profile-client";

export const metadata: Metadata = {
  title: "Customer profile",
};

export default function CustomerProfilePage() {
  return <CustomerProfileClient />;
}
