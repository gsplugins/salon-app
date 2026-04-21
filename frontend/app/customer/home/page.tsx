import type { Metadata } from "next";
import { CustomerHomeClient } from "../dashboard/customer-home-client";

export const metadata: Metadata = {
  title: "Customer home",
};

export default function CustomerHomePage() {
  return <CustomerHomeClient />;
}

