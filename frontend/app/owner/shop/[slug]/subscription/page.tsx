import type { Metadata } from "next";
import { ShopSubscriptionPageClient } from "./shop-subscription-page-client";

export const metadata: Metadata = {
  title: "Subscription — Shop manager",
};

export default function OwnerShopSubscriptionPage() {
  return <ShopSubscriptionPageClient />;
}
