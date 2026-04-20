"use client";

import { OwnerShopSlugGate, useOwnerShopContext } from "@/components/auth/owner-shop-slug-gate";
import { OwnerShopSidebarShell } from "@/components/platform/owner-shop-sidebar-shell";

function Shell({ children }: { children: React.ReactNode }) {
  const { slug, shopName } = useOwnerShopContext();
  return <OwnerShopSidebarShell shopSlug={slug} shopName={shopName}>{children}</OwnerShopSidebarShell>;
}

export function OwnerShopLayoutClient(props: { slug: string; children: React.ReactNode }) {
  const { slug, children } = props;
  return (
    <OwnerShopSlugGate slug={slug}>
      <Shell>{children}</Shell>
    </OwnerShopSlugGate>
  );
}
