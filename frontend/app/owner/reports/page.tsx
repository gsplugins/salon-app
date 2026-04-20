import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Redirect — Reports",
};

export default function OwnerReportsRedirectPage() {
  return <RedirectToOwnerShop segment="reports" />;
}
