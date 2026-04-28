"use client";

import { useState } from "react";
import { RoleProfilePanel, type SessionAccountTab } from "@/components/auth/role-profile-panel";
import { canAccessSuperAdmin } from "@/lib/role-access";
import type { AuthMePayload } from "@/lib/auth-api";

const accountTabList = (showPlatform: boolean): { id: SessionAccountTab; label: string }[] => [
  { id: "profile", label: "Profile" },
  { id: "workspace", label: "Salon access" },
  ...(showPlatform ? [{ id: "platform" as const, label: "Platform" }] : []),
];

/**
 * Profile / roles / platform only. Day-to-day shop tools live in the sidebar (services, queue, etc.).
 */
export function OwnerAccountWorkspace(props: { me: AuthMePayload }) {
  const { me } = props;
  const [accountSub, setAccountSub] = useState<SessionAccountTab>("profile");
  const showPlatformTab = canAccessSuperAdmin(me);
  const accountTabs = accountTabList(showPlatformTab);
  const effectiveAccountSub: SessionAccountTab =
    accountSub === "platform" && !showPlatformTab ? "profile" : accountSub;

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
      <div className="border-b border-zinc-200/90 bg-zinc-50/95 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/50 sm:px-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-800 dark:text-rose-200">
          Account
        </p>
        <p className="mt-1 text-xs text-zinc-800 dark:text-zinc-400">
          Your identity, roles, and platform access. Bookings, catalog, and reports use the admin menu — not here.
        </p>

        <div
          className="mt-4 flex w-full gap-1 overflow-x-auto rounded-2xl border border-zinc-200/80 bg-zinc-100/60 p-1 dark:border-zinc-700 dark:bg-zinc-900/80 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Account sections"
        >
          {accountTabs.map((t) => {
            const active = effectiveAccountSub === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setAccountSub(t.id)}
                className={`shrink-0 rounded-xl px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-white text-zinc-800 shadow-sm dark:bg-zinc-800 dark:text-white"
                    : "text-zinc-800 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
                }`}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <RoleProfilePanel me={me} variant="session" sessionAccountTab={effectiveAccountSub} />
      </div>
    </div>
  );
}
