import type { Metadata } from "next";
import { ShopNotificationsPageClient } from "./shop-notifications-page-client";

export const metadata: Metadata = {
  title: "Notifications — Shop manager",
};

export default function OwnerShopNotificationsPage() {
  return <ShopNotificationsPageClient />;
}
