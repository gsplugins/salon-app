import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Redirect — Staff",
};

export default function OwnerStaffRedirectPage() {
  return <RedirectToOwnerShop segment="staff" />;
}
