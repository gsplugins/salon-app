import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Redirect — Services",
};

export default function OwnerServicesRedirectPage() {
  return <RedirectToOwnerShop segment="services" />;
}
