import type { Metadata } from "next";
import { AdminAnalyticsClient } from "./admin-analytics-client";

export const metadata: Metadata = {
  title: "Admin — Analytics",
};

export default function Page() {
  return <AdminAnalyticsClient />;
}
