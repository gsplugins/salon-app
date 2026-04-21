import { redirect } from "next/navigation";

export default async function CustomerBookingFlowPage(props: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await props.params;
  redirect(`/book/${encodeURIComponent(shopId)}`);
}

