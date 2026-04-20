"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchAuthMe } from "@/lib/auth-api";
import { useSalonAccessTokenReady } from "@/hooks/use-salon-access-token";
import { ownerShopPath } from "@/lib/owner-shop-paths";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Sends users from legacy `/owner/dashboard`, `/owner/services`, … to `/owner/shop/{shopSlug}/…`.
 */
export function RedirectToOwnerShop(props: { segment?: string }) {
  const { segment } = props;
  const router = useRouter();
  const { token, ready } = useSalonAccessTokenReady();

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      if (!token) {
        router.replace("/app");
        return;
      }
      const res = await fetchAuthMe(token);
      if (!res.ok || !res.data.shop?.slug) {
        router.replace("/app");
        return;
      }
      const href = ownerShopPath(res.data.shop.slug, segment);
      router.replace(href);
    })();
  }, [ready, token, segment, router]);

  return (
    <div className="space-y-3 p-4 md:p-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full rounded-2xl" />
    </div>
  );
}
