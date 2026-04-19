import type { Metadata } from "next";
import { OwnerQueueClient } from "./owner-queue-client";

export const metadata: Metadata = {
  title: "Queue — Shop owner",
};

export default function OwnerQueuePage() {
  return <OwnerQueueClient />;
}
