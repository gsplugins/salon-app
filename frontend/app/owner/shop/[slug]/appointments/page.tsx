import type { Metadata } from "next";
import { ShopAppointmentsPageClient } from "./shop-appointments-page-client";

export const metadata: Metadata = {
  title: "Appointments — Shop manager",
};

export default function OwnerShopAppointmentsPage() {
  return <ShopAppointmentsPageClient />;
}
