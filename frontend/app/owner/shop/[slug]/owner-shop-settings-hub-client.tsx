"use client";

import Link from "next/link";
import { Bell, CreditCard, FileText, Store } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ShopSettingsPanel } from "@/app/app/salon-shop-panels";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { fetchAuthMe, type AuthMePayload } from "@/lib/auth-api";
import { canViewShopBilling } from "@/lib/role-access";
import { ownerShopPath } from "@/lib/owner-shop-paths";
import { Skeleton } from "@/components/ui/skeleton";

type SettingsTab = "business" | "notifications" | "policies" | "payments";

const LS_NOTIF = (slug: string) => `salon_owner_notif_${slug}`;
const LS_POLICY = (slug: string) => `salon_owner_policy_${slug}`;

function SettingsBody({ token, shopSlug }: { token: string; shopSlug: string }) {
  const [tab, setTab] = useState<SettingsTab>("business");
  const [me, setMe] = useState<AuthMePayload | null>(null);
  const [smsReminders, setSmsReminders] = useState(true);
  const [emailDigest, setEmailDigest] = useState(false);
  const [newBookingAlert, setNewBookingAlert] = useState(true);
  const [policyText, setPolicyText] = useState("");
  const [policySaved, setPolicySaved] = useState(false);
  const [prefsHydrated, setPrefsHydrated] = useState(false);

  const loadMe = useCallback(async () => {
    const res = await fetchAuthMe(token);
    if (res.ok) setMe(res.data);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load /auth/me for billing tab
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset hydration flag when shop changes
    setPrefsHydrated(false);
    if (typeof window === "undefined") {
      setPrefsHydrated(true);
      return;
    }
    try {
      const raw = localStorage.getItem(LS_NOTIF(shopSlug));
      if (raw) {
        const j = JSON.parse(raw) as {
          smsReminders?: boolean;
          emailDigest?: boolean;
          newBookingAlert?: boolean;
        };
        if (typeof j.smsReminders === "boolean") setSmsReminders(j.smsReminders);
        if (typeof j.emailDigest === "boolean") setEmailDigest(j.emailDigest);
        if (typeof j.newBookingAlert === "boolean") setNewBookingAlert(j.newBookingAlert);
      }
      const p = localStorage.getItem(LS_POLICY(shopSlug));
      if (p) setPolicyText(p);
    } catch {
      /* ignore */
    } finally {
      setPrefsHydrated(true);
    }
  }, [shopSlug]);

  useEffect(() => {
    if (!prefsHydrated || typeof window === "undefined") return;
    localStorage.setItem(
      LS_NOTIF(shopSlug),
      JSON.stringify({ smsReminders, emailDigest, newBookingAlert })
    );
  }, [prefsHydrated, shopSlug, smsReminders, emailDigest, newBookingAlert]);

  function savePolicy() {
    if (typeof window === "undefined") return;
    localStorage.setItem(LS_POLICY(shopSlug), policyText);
    setPolicySaved(true);
    window.setTimeout(() => setPolicySaved(false), 2000);
  }

  const tabs: { id: SettingsTab; label: string; icon: typeof Store }[] = [
    { id: "business", label: "Business & contact", icon: Store },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "policies", label: "Policies", icon: FileText },
    { id: "payments", label: "Billing & payments", icon: CreditCard },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="border-b border-zinc-200/90 bg-zinc-50/95 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-950/50 sm:px-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-rose-800 dark:text-rose-200">
            Shop preferences
          </p>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Hours, contact, alerts, and policies. Operations (bookings calendar, services, staff) stay in their menu
            items — no duplicate consoles here.
          </p>
          <div
            className="mt-4 flex gap-1 overflow-x-auto rounded-2xl border border-zinc-200/80 bg-zinc-100/60 p-1 dark:border-zinc-700 dark:bg-zinc-900/80 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="tablist"
            aria-label="Shop settings sections"
          >
            {tabs.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                      : "text-zinc-600 hover:bg-white/70 dark:text-zinc-400 dark:hover:bg-zinc-800/80"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                  <span className="whitespace-nowrap">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {tab === "business" && <ShopSettingsPanel accessToken={token} />}

          {tab === "notifications" && (
            <div className="mx-auto max-w-xl space-y-6">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Customer &amp; team alerts</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Preferences are stored on this device for the demo. Wire to your SMS/email provider in production.
                </p>
              </div>
              <ul className="space-y-4">
                <li className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">SMS appointment reminders</p>
                    <p className="mt-0.5 text-sm text-zinc-500">Send a reminder before each visit.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={smsReminders}
                    onClick={() => setSmsReminders((v) => !v)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      smsReminders ? "bg-rose-600" : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        smsReminders ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </li>
                <li className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">Email daily summary</p>
                    <p className="mt-0.5 text-sm text-zinc-500">Tomorrow&apos;s schedule and revenue snapshot.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={emailDigest}
                    onClick={() => setEmailDigest((v) => !v)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      emailDigest ? "bg-rose-600" : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        emailDigest ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </li>
                <li className="flex items-start justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-950/40">
                  <div>
                    <p className="font-medium text-zinc-900 dark:text-white">Push / in-app new booking</p>
                    <p className="mt-0.5 text-sm text-zinc-500">Alert when a customer books online.</p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={newBookingAlert}
                    onClick={() => setNewBookingAlert((v) => !v)}
                    className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                      newBookingAlert ? "bg-rose-600" : "bg-zinc-300 dark:bg-zinc-600"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        newBookingAlert ? "translate-x-5" : ""
                      }`}
                    />
                  </button>
                </li>
              </ul>
            </div>
          )}

          {tab === "policies" && (
            <div className="mx-auto max-w-xl space-y-4">
              <div>
                <h2 className="text-base font-semibold text-zinc-900 dark:text-white">Cancellation &amp; rules</h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  Shown to customers on your booking flow when you connect this field in the product.
                </p>
              </div>
              <textarea
                value={policyText}
                onChange={(e) => setPolicyText(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="e.g. Cancellations within 24 hours may be charged 50% of the service price."
              />
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={savePolicy}
                  className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
                >
                  Save draft
                </button>
                {policySaved ? (
                  <span className="text-sm text-emerald-700 dark:text-emerald-300">Saved on this device.</span>
                ) : null}
              </div>
            </div>
          )}

          {tab === "payments" && (
            <div className="mx-auto max-w-xl space-y-6">
              {!me ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : (
                <>
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Subscription</h3>
                    {canViewShopBilling(me) && me.subscription ? (
                      <dl className="mt-3 space-y-2 text-sm">
                        <div className="flex justify-between gap-4">
                          <dt className="text-zinc-500">Plan</dt>
                          <dd className="font-medium text-zinc-900 dark:text-white">{me.subscription.plan_key}</dd>
                        </div>
                        <div className="flex justify-between gap-4">
                          <dt className="text-zinc-500">Status</dt>
                          <dd className="font-medium text-zinc-900 dark:text-white">{me.subscription.status}</dd>
                        </div>
                      </dl>
                    ) : (
                      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Subscription details are visible to the shop owner only.
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-4 dark:border-zinc-600 dark:bg-zinc-950/40">
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">bKash &amp; payouts</h3>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                      Connect merchant numbers, settlement schedule, and receipt templates in your payment dashboard
                      (integration placeholder).
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200/80 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Operations shortcuts</p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Manage day-to-day work from the sidebar — same tools, one place each.
        </p>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm">
          <li>
            <Link
              href={ownerShopPath(shopSlug, "services")}
              className="font-medium text-rose-800 underline dark:text-rose-200"
            >
              Services &amp; pricing
            </Link>
          </li>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <li>
            <Link href={ownerShopPath(shopSlug, "queue")} className="font-medium text-rose-800 underline dark:text-rose-200">
              Walk-in queue
            </Link>
          </li>
          <span className="text-zinc-300 dark:text-zinc-600">·</span>
          <li>
            <Link
              href={ownerShopPath(shopSlug, "reports")}
              className="font-medium text-rose-800 underline dark:text-rose-200"
            >
              Reports
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}

export function OwnerShopSettingsHubClient({ shopSlug }: { shopSlug: string }) {
  return (
    <SalonManagementGate>
      {(token) => <SettingsBody token={token} shopSlug={shopSlug} />}
    </SalonManagementGate>
  );
}
