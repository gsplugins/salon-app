import { OwnerShopLayoutClient } from "./owner-shop-layout-client";

export default async function OwnerShopSegmentLayout(props: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  return <OwnerShopLayoutClient slug={slug}>{props.children}</OwnerShopLayoutClient>;
}
