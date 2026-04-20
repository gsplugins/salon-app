"use client";

import { OwnerShopAdminShopCard } from "@/components/platform/owner-shop-admin-shop-card";
import { OwnerShopNavLinks } from "@/components/platform/owner-shop-nav-links";

export function OwnerAppOwnerSessionHub(props: {
  shopName: string;
  shopSlug: string;
  busy: boolean;
  hasRefreshToken: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const { shopName, shopSlug, busy, hasRefreshToken, onRefresh, onLogout } = props;

  return (
    <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-800 dark:text-rose-200">
          Shop owner
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Same sections as your{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">owner admin sidebar</span>. Use{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Account</span> for your profile and{" "}
          <span className="font-medium text-zinc-800 dark:text-zinc-200">Shop preferences</span> for hours, alerts, and
          policies.
        </p>
      </div>
      <div className="space-y-4 p-4 sm:p-5">
        <OwnerShopAdminShopCard shopName={shopName} shopSlug={shopSlug} />
        <div className="rounded-2xl border border-zinc-200/90 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/30">
          <OwnerShopNavLinks shopSlug={shopSlug} variant="embedded" />
        </div>
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50/90 p-5 dark:border-zinc-700 dark:bg-zinc-950/40">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Session</h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Rotate access tokens or sign out on this device.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void onRefresh()}
              disabled={busy || !hasRefreshToken}
              className="min-h-11 rounded-full bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white touch-manipulation active:scale-[0.99] disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
            >
              Refresh tokens
            </button>
            <button
              type="button"
              onClick={() => void onLogout()}
              disabled={busy}
              className="min-h-11 rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold touch-manipulation active:scale-[0.99] dark:border-zinc-600"
            >
              Sign out
            </button>
          </div>
          <p className="mt-4 text-xs text-zinc-500">
            Tokens use <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">localStorage</code> in this demo.
            Native apps should use secure storage.
          </p>
        </div>
      </div>
    </div>
  );
}
