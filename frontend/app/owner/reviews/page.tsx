import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const metadata: Metadata = {
  title: "Redirect — Reviews",
};

export default function OwnerReviewsRedirectPage() {
  return <RedirectToOwnerShop segment="reviews" />;
}
