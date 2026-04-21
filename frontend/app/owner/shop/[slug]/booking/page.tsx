import type { Metadata } from "next";
import { ShopBookingPageClient } from "./shop-booking-page-client";

export const metadata: Metadata = {
  title: "Booking rules — Shop manager",
};

export default function OwnerShopBookingPage() {
  return <ShopBookingPageClient />;
}
