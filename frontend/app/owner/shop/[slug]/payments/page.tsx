import type { Metadata } from "next";
import { ShopPaymentsPageClient } from "./shop-payments-page-client";

export const metadata: Metadata = {
  title: "Payments — Shop manager",
};

export default function OwnerShopPaymentsPage() {
  return <ShopPaymentsPageClient />;
}
