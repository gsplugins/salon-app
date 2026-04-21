import type { Metadata } from "next";
import { StaffReviewsClient } from "./staff-reviews-client";

export const metadata: Metadata = {
  title: "Staff reviews",
};

export default function StaffReviewsPage() {
  return <StaffReviewsClient />;
}
