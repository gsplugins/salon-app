import type { Metadata } from "next";
import { OwnerInventoryClient } from "./owner-inventory-client";

export const metadata: Metadata = {
  title: "Inventory — Owner",
};

export default function OwnerInventoryPage() {
  return <OwnerInventoryClient />;
}
