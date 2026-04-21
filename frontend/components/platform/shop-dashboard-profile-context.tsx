"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { ShopProfile } from "@/lib/salon-api";

type ShopDashboardProfileContextValue = {
  profile: ShopProfile | null;
  profileLoading: boolean;
  setProfile: (p: ShopProfile | null) => void;
  setProfileLoading: (v: boolean) => void;
};

const ShopDashboardProfileContext = createContext<ShopDashboardProfileContextValue | null>(null);

export function ShopDashboardProfileProvider(props: { children: React.ReactNode }) {
  const [profile, setProfile] = useState<ShopProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const value = useMemo(
    () => ({ profile, profileLoading, setProfile, setProfileLoading }),
    [profile, profileLoading]
  );
  return <ShopDashboardProfileContext.Provider value={value}>{props.children}</ShopDashboardProfileContext.Provider>;
}

export function useShopDashboardProfileState(): ShopDashboardProfileContextValue {
  const v = useContext(ShopDashboardProfileContext);
  if (!v) {
    throw new Error("useShopDashboardProfileState must be used under ShopDashboardProfileProvider");
  }
  return v;
}
