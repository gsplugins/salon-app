"use client";

import { CustomerPanelGate } from "@/components/customer/customer-panel-gate";
import { CustomerPanelLayout } from "@/components/customer/customer-panel-layout";

export function CustomerPortalRoot({ children }: { children: React.ReactNode }) {
  return <CustomerPanelGate>{(token) => <CustomerPanelLayout accessToken={token}>{children}</CustomerPanelLayout>}</CustomerPanelGate>;
}
