import type { Metadata } from "next";
import { OwnerReviewsClient } from "../../../reviews/owner-reviews-client";

export const metadata: Metadata = {
  title: "Reviews — Shop owner",
};

export default function OwnerShopReviewsPage() {
  return <OwnerReviewsClient />;
}
