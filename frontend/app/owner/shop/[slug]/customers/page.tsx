import type { Metadata } from "next";
import { ShopCustomersPageClient } from "./shop-customers-page-client";

export const metadata: Metadata = {
  title: "Customers — Shop manager",
};

export default function OwnerShopCustomersPage() {
  return <ShopCustomersPageClient />;
}
