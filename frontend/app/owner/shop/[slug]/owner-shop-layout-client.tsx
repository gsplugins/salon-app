"use client";

import { useCallback, useEffect } from "react";
import { OwnerShopSlugGate, useOwnerShopContext } from "@/components/auth/owner-shop-slug-gate";
import { OwnerShopSidebarShell } from "@/components/platform/owner-shop-sidebar-shell";
import {
  ShopDashboardProfileProvider,
  useShopDashboardProfileState,
} from "@/components/platform/shop-dashboard-profile-context";
import { useSalonAccessTokenReady } from "@/hooks/use-salon-access-token";
import { fetchShopProfile } from "@/lib/salon-api";

function ShellWithProfile(props: { children: React.ReactNode }) {
  const { slug, shopName, actingAsSuperAdmin, me } = useOwnerShopContext();
  const { token, ready } = useSalonAccessTokenReady();
  const { setProfile, setProfileLoading, profile, profileLoading } = useShopDashboardProfileState();

  const loadProfile = useCallback(async () => {
    if (!ready) return;
    if (!token) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }
    setProfileLoading(true);
    const res = await fetchShopProfile(token);
    if (res.ok) {
      setProfile(res.data);
    } else {
      setProfile(null);
    }
    setProfileLoading(false);
  }, [ready, token, setProfile, setProfileLoading]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile, slug]);

  return (
    <OwnerShopSidebarShell
      shopSlug={slug}
      shopName={shopName}
      me={me}
      actingAsSuperAdmin={actingAsSuperAdmin}
      shopProfile={profile}
      profileLoading={profileLoading}
    >
      {props.children}
    </OwnerShopSidebarShell>
  );
}

function Shell(props: { children: React.ReactNode }) {
  return (
    <ShopDashboardProfileProvider>
      <ShellWithProfile>{props.children}</ShellWithProfile>
    </ShopDashboardProfileProvider>
  );
}

export function OwnerShopLayoutClient(props: { slug: string; children: React.ReactNode }) {
  const { slug, children } = props;
  return (
    <OwnerShopSlugGate slug={slug}>
      <Shell>{children}</Shell>
    </OwnerShopSlugGate>
  );
}
