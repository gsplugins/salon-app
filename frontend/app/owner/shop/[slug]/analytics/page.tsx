import type { Metadata } from "next";
import { ShopAnalyticsPageClient } from "./shop-analytics-page-client";

export const metadata: Metadata = {
  title: "Analytics — Shop manager",
};

export default function OwnerShopAnalyticsPage() {
  return <ShopAnalyticsPageClient />;
}
