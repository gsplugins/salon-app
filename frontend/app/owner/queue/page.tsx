import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Redirect — Queue",
};

export default function OwnerQueueRedirectPage() {
  return <RedirectToOwnerShop segment="queue" />;
}
