import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Redirect — Shop owner",
};

export default function OwnerDashboardRedirectPage() {
  return <RedirectToOwnerShop />;
}
