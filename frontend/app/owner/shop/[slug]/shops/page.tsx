import type { Metadata } from "next";
import { OwnerShopsClient } from "../../../shops/owner-shops-client";

export const metadata: Metadata = {
  title: "Branches — Shop owner",
};

export default function OwnerShopBranchesPage() {
  return <OwnerShopsClient />;
}
