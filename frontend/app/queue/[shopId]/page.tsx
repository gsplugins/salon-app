import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PublicShopDetailPayload } from "@/lib/salon-api";
import { serverFetchJson } from "@/lib/server-api";
import { QueuePageClient } from "./queue-page-client";

type Props = { params: Promise<{ shopId: string }> };

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { shopId } = await props.params;
  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${shopId}`);
  const name = raw?.data?.shop?.name;
  return { title: name ? `Queue — ${name}` : `Queue — ${shopId}` };
}

export default async function QueueStatusPage(props: Props) {
  const { shopId } = await props.params;
  const id = Number.parseInt(shopId, 10);
  if (Number.isNaN(id)) notFound();

  const raw = await serverFetchJson<{ data: PublicShopDetailPayload }>(`/public/shops/${id}`);
  const shopName = raw?.data?.shop?.name;

  return <QueuePageClient shopId={id} shopName={shopName} />;
}
