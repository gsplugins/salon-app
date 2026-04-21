import type { Metadata } from "next";
import { ShopGeneralPageClient } from "./shop-general-page-client";

export const metadata: Metadata = {
  title: "General — Shop manager",
  description: "Shop name, media URLs, contact, hours, holidays, and about.",
};

export default function OwnerShopGeneralPage() {
  return <ShopGeneralPageClient />;
}
