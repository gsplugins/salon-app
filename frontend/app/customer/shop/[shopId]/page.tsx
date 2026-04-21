import { redirect } from "next/navigation";

export default async function CustomerShopProfilePage(props: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await props.params;
  redirect(`/shops/${encodeURIComponent(shopId)}`);
}

