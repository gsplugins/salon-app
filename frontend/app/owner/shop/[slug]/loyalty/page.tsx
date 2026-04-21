import type { Metadata } from "next";
import { ShopLoyaltyPageClient } from "./shop-loyalty-page-client";

export const metadata: Metadata = {
  title: "Loyalty — Shop manager",
};

export default function OwnerShopLoyaltyPage() {
  return <ShopLoyaltyPageClient />;
}
