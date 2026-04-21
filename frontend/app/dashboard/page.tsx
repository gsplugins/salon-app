import { redirect } from "next/navigation";

export default function LegacyDashboardPage() {
  redirect("/customer/dashboard");
}
