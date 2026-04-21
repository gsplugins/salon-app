"use client";

import { StaffPwaRegister } from "@/components/staff/staff-pwa-register";
import { StaffPanelGate } from "@/components/staff/staff-panel-gate";
import { StaffPanelLayout } from "@/components/staff/staff-panel-layout";

export function StaffPortalRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      <StaffPwaRegister />
      <StaffPanelGate>{(token) => <StaffPanelLayout accessToken={token}>{children}</StaffPanelLayout>}</StaffPanelGate>
    </>
  );
}
