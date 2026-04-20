import type { Metadata } from "next";
import { OwnerShopHubClient } from "./owner-shop-hub-client";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  return {
    title: `Shop hub — ${decodeURIComponent(slug)}`,
    description: "Owner overview and analytics. Account and shop preferences are in Settings.",
  };
}

export default async function OwnerShopHubPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  return <OwnerShopHubClient shopSlug={slug} />;
}
