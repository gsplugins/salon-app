import type { Metadata } from "next";
import { OwnerInventoryClient } from "../../../inventory/owner-inventory-client";

export const metadata: Metadata = {
  title: "Inventory — Shop owner",
};

export default function OwnerShopInventoryPage() {
  return <OwnerInventoryClient />;
}
