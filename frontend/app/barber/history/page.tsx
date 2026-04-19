import type { Metadata } from "next";
import { BarberHistoryClient } from "../barber-history-client";

export const metadata: Metadata = {
  title: "Barber — History",
};

export default function BarberHistoryPage() {
  return <BarberHistoryClient />;
}
