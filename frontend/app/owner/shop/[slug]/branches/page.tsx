import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ownerShopPath } from "@/lib/owner-shop-paths";

export const metadata: Metadata = {
  title: "Branches — Shop manager",
};

export default async function OwnerShopBranchesAliasPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  redirect(ownerShopPath(slug, "shops"));
}
