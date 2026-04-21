import type { Metadata } from "next";
import { CustomerLoyaltyClient } from "./customer-loyalty-client";

export const metadata: Metadata = {
  title: "Loyalty",
};

export default function CustomerLoyaltyPage() {
  return <CustomerLoyaltyClient />;
}
