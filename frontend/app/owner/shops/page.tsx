import type { Metadata } from "next";
import { OwnerShopsClient } from "./owner-shops-client";

export const metadata: Metadata = {
  title: "Branches — Owner",
};

export default function OwnerShopsPage() {
  return <OwnerShopsClient />;
}
