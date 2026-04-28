import type { Metadata } from "next";
import { OwnerShopAccountClient } from "../owner-shop-account-client";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const s = decodeURIComponent(slug);
  return {
    title: `Account — ${s}`,
    description: "Your profile, roles, and platform access for this shop.",
  };
}

export default async function OwnerShopAccountPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-800 dark:text-white">Account</h1>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">
          Profile and roles only. For hours, contact, alerts, and policies, open{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Shop preferences</span> in the sidebar.
        </p>
      </div>
      <OwnerShopAccountClient shopSlug={slug} />
    </div>
  );
}
