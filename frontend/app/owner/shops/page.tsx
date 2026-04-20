import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Redirect — Branches",
};

export default function OwnerShopsRedirectPage() {
  return <RedirectToOwnerShop segment="shops" />;
}
