/**
 * Owner area: full UI lives under `/owner/[shopSlug]/…` with sidebar in `OwnerShopSidebarShell`.
 * Legacy `/owner/dashboard` etc. redirect to the slugged routes.
 */
export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
