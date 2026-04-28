"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createBkashPayment,
  deleteSystemShop,
  fetchBkashPayments,
  fetchSystemShops,
  formatApiError,
  patchSystemShop,
  patchSystemUser,
  postExtendSubscription,
  postSystemResetPassword,
  type BkashPaymentRow,
  type Paginated,
  type SystemShopFilter,
  type SystemShopRow,
} from "@/lib/salon-api";

const FILTERS: { id: SystemShopFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "paid", label: "Paid" },
  { id: "unpaid", label: "Unpaid" },
  { id: "expired", label: "Expired" },
  { id: "locked", label: "Locked" },
];

function formatBdtPaisa(paisa: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(paisa / 100);
}

function formatWhen(iso: string | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

function subLabel(row: SystemShopRow): string {
  const sub = row.subscription;
  if (!sub) return "No subscription";
  const parts = [`${sub.plan_key} · ${sub.status}`];
  if (sub.current_period_end) {
    parts.push(`ends ${formatWhen(sub.current_period_end)}`);
  }
  return parts.join(" · ");
}

function approvalBadge(status: string | undefined): string {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Pending";
}

type Tab = "salons" | "bkash";

export function SystemSuperAdmin({ accessToken }: { accessToken: string }) {
  const [tab, setTab] = useState<Tab>("salons");
  const [filter, setFilter] = useState<SystemShopFilter>("all");
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [shopPage, setShopPage] = useState<Paginated<SystemShopRow> | null>(null);
  const [bkashPage, setBkashPage] = useState<Paginated<BkashPaymentRow> | null>(null);
  const [bkashPageNum, setBkashPageNum] = useState(1);

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [extendRow, setExtendRow] = useState<SystemShopRow | null>(null);
  const [extendDays, setExtendDays] = useState("30");

  const [resetTarget, setResetTarget] = useState<{ userId: number; label: string } | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  const [bkashShopId, setBkashShopId] = useState("");
  const [bkashAmountPaisa, setBkashAmountPaisa] = useState("");
  const [bkashTrx, setBkashTrx] = useState("");
  const [bkashNote, setBkashNote] = useState("");
  const [editShop, setEditShop] = useState<SystemShopRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editStaffLimit, setEditStaffLimit] = useState("30");
  const [editApproval, setEditApproval] = useState<"pending" | "approved" | "rejected">("pending");

  const loadShops = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    const res = await fetchSystemShops(accessToken, { search: search || undefined, filter, page });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setShopPage(res.data);
  }, [accessToken, search, filter, page]);

  const loadBkash = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    const res = await fetchBkashPayments(accessToken, bkashPageNum);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setBkashPage(res.data);
  }, [accessToken, bkashPageNum]);

  useEffect(() => {
    if (tab !== "salons") return;
     
    void loadShops();
  }, [tab, loadShops]);

  useEffect(() => {
    if (tab !== "bkash") return;
     
    void loadBkash();
  }, [tab, loadBkash]);

  async function toggleShopActive(s: SystemShopRow) {
    setBusy(true);
    const res = await patchSystemShop(accessToken, s.id, { is_active: !s.is_active });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Shop updated." });
    void loadShops();
  }

  async function approveShop(s: SystemShopRow) {
    setBusy(true);
    const res = await patchSystemShop(accessToken, s.id, { approval_status: "approved", is_active: true });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Shop approved." });
    void loadShops();
  }

  async function toggleOwnerLock(s: SystemShopRow) {
    const owner = s.owner;
    if (!owner) return;
    const next = !owner.is_locked;
    setBusy(true);
    const res = await patchSystemUser(accessToken, owner.id, { is_locked: next });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: next ? "Account locked." : "Account unlocked." });
    void loadShops();
  }

  async function submitExtend() {
    if (!extendRow?.subscription) return;
    const days = Number.parseInt(extendDays, 10);
    if (Number.isNaN(days) || days < 1) return;
    setBusy(true);
    const res = await postExtendSubscription(accessToken, extendRow.subscription.id, days);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: `Subscription extended by ${days} days.` });
    setExtendRow(null);
    void loadShops();
  }

  async function submitReset() {
    if (!resetTarget) return;
    if (resetPassword.length < 8) {
      setNotice({ type: "err", text: "Password must be at least 8 characters." });
      return;
    }
    setBusy(true);
    const res = await postSystemResetPassword(accessToken, resetTarget.userId, resetPassword);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Password reset. Owner must sign in again." });
    setResetTarget(null);
    setResetPassword("");
  }

  async function submitBkash() {
    const shopId = Number.parseInt(bkashShopId, 10);
    const amt = Number.parseInt(bkashAmountPaisa, 10);
    if (Number.isNaN(shopId) || shopId < 1) {
      setNotice({ type: "err", text: "Enter a valid shop ID." });
      return;
    }
    if (Number.isNaN(amt) || amt < 0) {
      setNotice({ type: "err", text: "Enter amount in paisa (e.g. 150000 for ৳1500.00)." });
      return;
    }
    setBusy(true);
    const res = await createBkashPayment(accessToken, {
      shop_id: shopId,
      amount_paisa: amt,
      trx_id: bkashTrx.trim() === "" ? undefined : bkashTrx.trim(),
      note: bkashNote.trim() === "" ? undefined : bkashNote.trim(),
      status: "completed",
    });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Payment recorded." });
    setBkashShopId("");
    setBkashAmountPaisa("");
    setBkashTrx("");
    setBkashNote("");
    void loadBkash();
  }

  async function submitEditShop() {
    if (!editShop) return;
    const lim = Number.parseInt(editStaffLimit, 10);
    if (Number.isNaN(lim) || lim < 1) {
      setNotice({ type: "err", text: "Staff limit must be at least 1." });
      return;
    }
    setBusy(true);
    const res = await patchSystemShop(accessToken, editShop.id, {
      name: editName.trim(),
      slug: editSlug.trim(),
      staff_limit: lim,
      approval_status: editApproval,
    });
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Shop settings updated." });
    setEditShop(null);
    void loadShops();
  }

  async function removeShop(s: SystemShopRow) {
    const ok = confirm(`Delete shop "${s.name}"? This cannot be undone.`);
    if (!ok) return;
    setBusy(true);
    const res = await deleteSystemShop(accessToken, s.id);
    setBusy(false);
    if (!res.ok) {
      setNotice({ type: "err", text: formatApiError(res.body) });
      return;
    }
    setNotice({ type: "ok", text: "Shop deleted." });
    void loadShops();
  }

  const rows = shopPage?.data ?? [];
  const bkashRows = bkashPage?.data ?? [];

  return (
    <div className="mt-10 space-y-6 border-t border-rose-100/80 pt-10 dark:border-zinc-800">
      <div>
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-white">Master admin</h2>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">
          Central control for salons, subscriptions, bKash payment records, and account security.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab("salons")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === "salons"
              ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-800"
              : "border border-zinc-200 text-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
          }`}
        >
          Salons & users
        </button>
        <button
          type="button"
          onClick={() => setTab("bkash")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            tab === "bkash"
              ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-800"
              : "border border-zinc-200 text-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
          }`}
        >
          bKash payments
        </button>
      </div>

      {notice && (
        <div
          className={`rounded-xl border px-3 py-2 text-sm ${
            notice.type === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-950 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
        >
          {notice.text}
        </div>
      )}

      {tab === "salons" && (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setFilter(f.id);
                    setPage(1);
                  }}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    filter === f.id
                      ? "bg-zinc-900 text-white dark:bg-rose-100 dark:text-zinc-800"
                      : "border border-zinc-200 text-zinc-800 dark:border-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex flex-1 flex-wrap gap-2 sm:min-w-[240px]">
              <input
                className="min-w-[180px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                placeholder="Search shop, slug, owner…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setSearch(searchDraft);
                    setPage(1);
                  }
                }}
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSearch(searchDraft);
                  setPage(1);
                }}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
              >
                Search
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
            <table className="w-full min-w-[1180px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
                <tr>
                  <th className="px-3 py-2">Salon</th>
                  <th className="px-3 py-2">Registered</th>
                  <th className="px-3 py-2">Owner</th>
                  <th className="px-3 py-2">Subscription</th>
                  <th className="px-3 py-2">Payments</th>
                  <th className="px-3 py-2">Limits</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-2">
                      <div className="font-medium">{s.name}</div>
                      <code className="text-xs text-zinc-800">/s/{s.slug}/book</code>
                      <div className="text-xs text-zinc-800">
                        {s.is_active ? "Shop on" : "Shop off"} · {approvalBadge(s.approval_status)}
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-zinc-800">{formatWhen(s.created_at)}</td>
                    <td className="px-3 py-2">
                      {s.owner ? (
                        <>
                          <div className="font-medium">{s.owner.name}</div>
                          <div className="font-mono text-xs text-zinc-800">{s.owner.mobile}</div>
                          {s.owner.is_locked ? (
                            <span className="text-xs font-semibold text-amber-800 dark:text-amber-200">Locked</span>
                          ) : null}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="max-w-[280px] px-3 py-2 text-xs text-zinc-800">{subLabel(s)}</td>
                    <td className="px-3 py-2 text-xs text-zinc-800">
                      <div>Total: {formatBdtPaisa(s.payment_summary?.total_paid_paisa ?? 0)}</div>
                      <div>Count: {s.payment_summary?.payments_count ?? 0}</div>
                      <div>Last: {formatWhen(s.payment_summary?.last_payment_at ?? undefined)}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-zinc-800">
                      Staff limit: {s.staff_limit ?? 30}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <button
                          type="button"
                          disabled={busy || s.approval_status === "approved"}
                          onClick={() => void approveShop(s)}
                          className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-40 dark:text-emerald-300"
                        >
                          Approve shop
                        </button>
                        <button
                          type="button"
                          disabled={busy || !s.subscription}
                          onClick={() => {
                            setExtendDays("30");
                            setExtendRow(s);
                          }}
                          className="text-xs font-semibold text-rose-800 hover:underline disabled:opacity-40 dark:text-rose-200"
                        >
                          Extend sub
                        </button>
                        {s.owner ? (
                          <>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void toggleOwnerLock(s)}
                              className="text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                            >
                              {s.owner.is_locked ? "Unlock account" : "Lock account"}
                            </button>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setResetPassword("");
                                setResetTarget({ userId: s.owner!.id, label: s.owner!.name });
                              }}
                              className="text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                            >
                              Reset password
                            </button>
                          </>
                        ) : null}
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void toggleShopActive(s)}
                          className="text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                        >
                          {s.is_active ? "Deactivate shop" : "Activate shop"}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setEditShop(s);
                            setEditName(s.name);
                            setEditSlug(s.slug);
                            setEditStaffLimit(String(s.staff_limit ?? 30));
                            setEditApproval((s.approval_status as "pending" | "approved" | "rejected") ?? "pending");
                          }}
                          className="text-xs font-semibold text-zinc-700 hover:underline dark:text-zinc-300"
                        >
                          Edit shop
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void removeShop(s)}
                          className="text-xs font-semibold text-red-700 hover:underline dark:text-red-300"
                        >
                          Delete shop
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && !busy && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-zinc-800">
                      No salons match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {shopPage && shopPage.last_page > 1 ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-800">
                Page {shopPage.current_page} of {shopPage.last_page} ({shopPage.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || shopPage.current_page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={busy || shopPage.current_page >= shopPage.last_page}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {tab === "bkash" && (
        <>
          <p className="text-sm text-zinc-800 dark:text-zinc-400">
            Ledger of bKash payments (manual entry for now; connect webhooks in production). Amounts are stored in{" "}
            <strong>paisa</strong> (৳1 = 100 paisa).
          </p>

          <div className="rounded-2xl border border-rose-100/80 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/40">
            <h3 className="text-base font-semibold text-zinc-800 dark:text-white">Record payment</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs font-medium text-zinc-800">
                Shop ID
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={bkashShopId}
                  onChange={(e) => setBkashShopId(e.target.value)}
                  inputMode="numeric"
                />
              </label>
              <label className="text-xs font-medium text-zinc-800">
                Amount (paisa)
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={bkashAmountPaisa}
                  onChange={(e) => setBkashAmountPaisa(e.target.value)}
                  inputMode="numeric"
                  placeholder="150000"
                />
              </label>
              <label className="text-xs font-medium text-zinc-800">
                Trx ID (optional)
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={bkashTrx}
                  onChange={(e) => setBkashTrx(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-zinc-800 sm:col-span-2 lg:col-span-4">
                Note (optional)
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={bkashNote}
                  onChange={(e) => setBkashNote(e.target.value)}
                />
              </label>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void submitBkash()}
              className="mt-4 rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
            >
              Save payment
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-rose-100/80 bg-white dark:border-zinc-800 dark:bg-zinc-900/40">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950/80">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Shop</th>
                  <th className="px-3 py-2">Amount</th>
                  <th className="px-3 py-2">Trx</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {bkashRows.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-3 py-2 whitespace-nowrap">{formatWhen(p.created_at)}</td>
                    <td className="px-3 py-2">
                      {p.shop ? (
                        <>
                          <div className="font-medium">{p.shop.name}</div>
                          <div className="text-xs text-zinc-800">#{p.shop_id}</div>
                        </>
                      ) : (
                        `#${p.shop_id}`
                      )}
                    </td>
                    <td className="px-3 py-2">{formatBdtPaisa(p.amount_paisa)}</td>
                    <td className="font-mono text-xs text-zinc-800">{p.trx_id ?? "—"}</td>
                    <td className="px-3 py-2 capitalize">{p.status}</td>
                  </tr>
                ))}
                {bkashRows.length === 0 && !busy && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-zinc-800">
                      No bKash payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {bkashPage && bkashPage.last_page > 1 ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-zinc-800">
                Page {bkashPage.current_page} of {bkashPage.last_page}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy || bkashPage.current_page <= 1}
                  onClick={() => setBkashPageNum((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={busy || bkashPage.current_page >= bkashPage.last_page}
                  onClick={() => setBkashPageNum((p) => p + 1)}
                  className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-600"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      {extendRow ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">Extend subscription</h3>
            <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">{extendRow.name}</p>
            <label className="mt-4 block text-xs font-medium text-zinc-800">
              Days to add
              <input
                type="number"
                min={1}
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={extendDays}
                onChange={(e) => setExtendDays(e.target.value)}
              />
            </label>
            <p className="mt-2 text-xs text-zinc-800">
              Extends from the current period end (or from today if already lapsed). Reactivates past-due or
              cancelled subscriptions.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setExtendRow(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitExtend()}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {resetTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">Reset password</h3>
            <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">{resetTarget.label}</p>
            <label className="mt-4 block text-xs font-medium text-zinc-800">
              New password (min 8 characters)
              <input
                type="password"
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
              />
            </label>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitReset()}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {editShop ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold text-zinc-800 dark:text-white">Edit shop</h3>
            <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">#{editShop.id}</p>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-medium text-zinc-800">
                Name
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-zinc-800">
                Slug
                <input
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={editSlug}
                  onChange={(e) => setEditSlug(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-zinc-800">
                Staff limit
                <input
                  type="number"
                  min={1}
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={editStaffLimit}
                  onChange={(e) => setEditStaffLimit(e.target.value)}
                />
              </label>
              <label className="text-xs font-medium text-zinc-800">
                Approval status
                <select
                  className="mt-1 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={editApproval}
                  onChange={(e) => setEditApproval(e.target.value as "pending" | "approved" | "rejected")}
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditShop(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-600"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submitEditShop()}
                className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-semibold text-white dark:bg-rose-100 dark:text-zinc-800"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
