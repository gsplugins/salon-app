import type { Metadata } from "next";
import { OwnerServicesClient } from "./owner-services-client";

export const metadata: Metadata = {
  title: "Services — Shop owner",
};

export default function OwnerServicesPage() {
  return <OwnerServicesClient />;
}
