import type { Metadata } from "next";
import { CustomerWaitlistClient } from "./customer-waitlist-client";

export const metadata: Metadata = {
  title: "My waitlist",
};

export default function CustomerWaitlistPage() {
  return <CustomerWaitlistClient />;
}
