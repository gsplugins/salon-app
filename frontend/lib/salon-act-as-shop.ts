/** Sent with API requests; Laravel `SalonManagementContext::ACT_AS_SHOP_SLUG_HEADER` must match. */
export const SALON_ACT_AS_SHOP_SLUG_HEADER = "X-Salon-Act-As-Shop-Slug";

const STORAGE_KEY = "salon_act_as_shop_slug";

export function setSalonActAsShopSlug(slug: string | null): void {
  if (typeof window === "undefined") return;
  if (slug === null || slug === "") {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, slug);
}

export function getSalonActAsShopSlug(): string | null {
  if (typeof window === "undefined") return null;
  const v = sessionStorage.getItem(STORAGE_KEY);
  if (v === null || v.trim() === "") return null;
  return v.trim();
}
