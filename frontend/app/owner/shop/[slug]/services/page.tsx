import type { Metadata } from "next";
import { OwnerServicesClient } from "../../../services/owner-services-client";

export const metadata: Metadata = {
  title: "Services — Shop owner",
};

export default function OwnerShopServicesPage() {
  return <OwnerServicesClient />;
}
