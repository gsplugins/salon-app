"use client";

import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { OwnerDashboardOverview } from "@/app/owner/owner-dashboard-client";

function HubBody({ token, shopSlug }: { token: string; shopSlug: string }) {
  return (
    <div className="space-y-8">
      <OwnerDashboardOverview token={token} shopSlug={shopSlug} />
    </div>
  );
}

export function OwnerShopHubClient({ shopSlug }: { shopSlug: string }) {
  return (
    <SalonManagementGate>
      {(token) => <HubBody token={token} shopSlug={shopSlug} />}
    </SalonManagementGate>
  );
}
