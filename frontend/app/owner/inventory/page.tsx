import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Redirect — Inventory",
};

export default function OwnerInventoryRedirectPage() {
  return <RedirectToOwnerShop segment="inventory" />;
}
