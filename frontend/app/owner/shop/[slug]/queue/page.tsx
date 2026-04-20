import type { Metadata } from "next";
import { OwnerQueueClient } from "../../../queue/owner-queue-client";

export const metadata: Metadata = {
  title: "Walk-in queue — Shop owner",
};

export default function OwnerShopQueuePage() {
  return <OwnerQueueClient />;
}
