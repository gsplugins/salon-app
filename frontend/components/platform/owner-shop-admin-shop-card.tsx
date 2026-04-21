import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { ShopProfile } from "@/lib/salon-api";
import { ownerNavIcons, ownerShopBookingPublicHref } from "@/lib/owner-shop-nav-config";

const { ExternalLink } = ownerNavIcons;

export function OwnerShopAdminShopCard(props: {
  shopName: string;
  shopSlug: string;
  shopProfile?: ShopProfile | null;
  profileLoading?: boolean;
}) {
  const { shopName, shopSlug, shopProfile, profileLoading } = props;
  const bookingHref = ownerShopBookingPublicHref(shopSlug);
  const settings = (shopProfile?.settings ?? {}) as Record<string, unknown>;
  const logoUrl = typeof settings.logo_url === "string" && settings.logo_url.trim() !== "" ? settings.logo_url : null;
  const planLabel =
    shopProfile?.subscription?.plan_name?.trim() ||
    shopProfile?.subscription?.plan_key ||
    (profileLoading ? "…" : null);

  return (
    <div className="rounded-xl bg-gradient-to-br from-rose-50 to-zinc-50 p-3 dark:from-rose-950/40 dark:to-zinc-950/80">
      <div className="flex items-start gap-2.5">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- external salon logo URLs
          <img
            src={logoUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-lg border border-rose-200/80 bg-white object-cover dark:border-rose-900/50"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white" title={shopName}>
            {shopName}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] text-zinc-500">/owner/shop/{shopSlug}</p>
          {planLabel ? (
            <div className="mt-2">
              <Badge className="text-[10px] font-semibold uppercase tracking-wide">
                {planLabel}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>
      <div className="mt-3">
        <Link
          href={bookingHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-200/80 bg-white px-3 py-2 text-xs font-semibold text-rose-900 shadow-sm transition hover:bg-rose-50 dark:border-rose-900/50 dark:bg-zinc-900 dark:text-rose-100 dark:hover:bg-rose-950/50"
        >
          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Customer booking page
        </Link>
      </div>
    </div>
  );
}
