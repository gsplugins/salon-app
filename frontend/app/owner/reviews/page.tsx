import type { Metadata } from "next";
import { OwnerReviewsClient } from "./owner-reviews-client";

export const metadata: Metadata = {
  title: "Reviews — Owner",
};

export default function OwnerReviewsPage() {
  return <OwnerReviewsClient />;
}
