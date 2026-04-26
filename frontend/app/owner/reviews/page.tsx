import type { Metadata } from "next";
import { RedirectToOwnerShop } from "@/components/auth/redirect-to-owner-shop";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Redirect — Reviews",
};

export default function OwnerReviewsRedirectPage() {
  return <RedirectToOwnerShop segment="reviews" />;
}
