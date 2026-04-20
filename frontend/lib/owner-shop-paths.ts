/**
 * Canonical owner URLs: `/owner/shop/{shopSlug}/…`
 * (`/owner/shop/…` avoids clashes with static routes like `/owner/services`.)
 */
export function ownerShopBase(slug: string): string {
  return `/owner/shop/${encodeURIComponent(slug)}`;
}

export function ownerShopPath(slug: string, segment?: string): string {
  const base = ownerShopBase(slug);
  if (!segment) return base;
  return `${base}/${segment}`;
}
