"use client";

import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { OwnerAccountWorkspace } from "@/components/platform/owner-account-workspace";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";

function AccountBody({ token, shopSlug }: { token: string; shopSlug: string }) {
  const [me, setMe] = useState<AuthMePayload | null>(null);

  const loadMe = useCallback(async () => {
    const res = await fetchAuthMe(token);
    if (res.ok) setMe(res.data);
    else setMe(null);
  }, [token]);

  useEffect(() => {
     
    void loadMe();
  }, [loadMe]);

  if (!me) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full max-w-md rounded-2xl" />
        <Skeleton className="h-72 w-full rounded-2xl" />
      </div>
    );
  }

  return <OwnerAccountWorkspace key={shopSlug} me={me} />;
}

export function OwnerShopAccountClient({ shopSlug }: { shopSlug: string }) {
  return (
    <SalonManagementGate>
      {(token) => <AccountBody token={token} shopSlug={shopSlug} />}
    </SalonManagementGate>
  );
}
