import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Shop owner — redirect",
};

/** `/owner/shop` → `/owner/shop/{activeShopSlug}` */
export default function OwnerShopIndexRedirectPage() {
  return <RedirectToOwnerShop />;
}
