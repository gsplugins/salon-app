import type { Metadata } from "next";
import { OwnerShopSettingsHubClient } from "../owner-shop-settings-hub-client";

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const s = decodeURIComponent(slug);
  return {
    title: `Shop preferences — ${s}`,
    description: "Business hours, contact, notifications, policies, and billing preferences.",
  };
}

export default async function OwnerShopSettingsPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-800 dark:text-white">Shop preferences</h1>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">
          Configure how your business appears and how you get notified. Day-to-day operations use the other menu items
          (queue, services, reports).
        </p>
      </div>
      <OwnerShopSettingsHubClient shopSlug={slug} />
    </div>
  );
}
