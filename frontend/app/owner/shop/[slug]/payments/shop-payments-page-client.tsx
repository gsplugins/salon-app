"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { useShopDashboardProfileState } from "@/components/platform/shop-dashboard-profile-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import {
  createOwnerManualPayment,
  fetchOwnerPayments,
  formatApiError,
  refundOwnerSalonPayment,
  type SalonPaymentRow,
  type OwnerPaymentsMeta,
} from "@/lib/salon-api";

function money(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "BDT" }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function Body({ accessToken }: { accessToken: string }) {
  const { profile, profileLoading } = useShopDashboardProfileState();
  const canPay = profile?.permissions?.can_manage_payments === true;
  const [rows, setRows] = useState<SalonPaymentRow[]>([]);
  const [meta, setMeta] = useState<OwnerPaymentsMeta | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [refundId, setRefundId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!canPay) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await fetchOwnerPayments(accessToken, { page, per_page: 15 });
    setLoading(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setRows(res.data);
    setMeta(res.meta);
  }, [accessToken, page, canPay]);

  useEffect(() => {
     
    void load();
  }, [load]);

  async function submitManual() {
    const raw = amount.replace(/[^0-9.]/g, "");
    const n = Number.parseFloat(raw);
    if (Number.isNaN(n) || n <= 0) {
      toast.error("Enter a valid amount");
      return;
    }
    const amount_cents = Math.round(n * 100);
    setBusy(true);
    const res = await createOwnerManualPayment(accessToken, { amount_cents, method, status: "completed" });
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Payment recorded");
    setAddOpen(false);
    setAmount("");
    void load();
  }

  async function confirmRefund() {
    if (refundId == null) return;
    setBusy(true);
    const res = await refundOwnerSalonPayment(accessToken, refundId);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Marked as refunded");
    setRefundId(null);
    void load();
  }

  if (profileLoading) {
    return <Skeleton className="h-48 w-full rounded-2xl" />;
  }

  if (!profile) {
    return <p className="text-sm text-red-600 dark:text-red-400">Shop profile could not be loaded.</p>;
  }

  if (!canPay) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
        Staff accounts cannot open shop payments. Sign in as owner or manager.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => setAddOpen(true)}>
          Record manual payment
        </Button>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
      </div>

      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <>
          <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 [&>div]:rounded-2xl [&>div]:border-0">
            <Table>
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Method</TH>
                  <TH>Amount</TH>
                  <TH>Status</TH>
                  <TH>Booking</TH>
                  <TH />
                </TR>
              </THead>
              <TBody>
                {rows.length === 0 ? (
                  <TR>
                    <TD colSpan={6} className="text-center text-sm text-zinc-500">
                      No payments yet.
                    </TD>
                  </TR>
                ) : (
                  rows.map((p) => (
                    <TR key={p.id}>
                      <TD className="whitespace-nowrap text-sm">
                        {p.created_at ? new Date(p.created_at).toLocaleString() : "—"}
                      </TD>
                      <TD className="text-sm capitalize">{p.method}</TD>
                      <TD className="text-sm font-medium">{money(p.amount_cents, p.currency)}</TD>
                      <TD className="text-sm">{p.status}</TD>
                      <TD className="text-xs text-zinc-600 dark:text-zinc-400">
                        {p.booking ? `${p.booking.customer_name}` : "—"}
                      </TD>
                      <TD className="text-right">
                        {p.status !== "refunded" ? (
                          <Button type="button" variant="destructive" className="text-xs" onClick={() => setRefundId(p.id)}>
                            Refund
                          </Button>
                        ) : null}
                      </TD>
                    </TR>
                  ))
                )}
              </TBody>
            </Table>
          </div>
          {meta && meta.last_page > 1 ? (
            <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
              <span>
                Page {meta.current_page} of {meta.last_page} ({meta.total} total)
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={meta.current_page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={meta.current_page >= meta.last_page}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="amt">Amount</Label>
              <Input id="amt" placeholder="e.g. 1500" className="mt-1" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="meth">Method</Label>
              <select
                id="meth"
                className="mt-1 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bkash">bKash</option>
                <option value="nagad">Nagad</option>
                <option value="stripe">Stripe</option>
                <option value="bank_transfer">Bank transfer</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={busy} onClick={() => void submitManual()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={refundId !== null} onOpenChange={(o) => !o && setRefundId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund payment?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">This marks the row as refunded in the ledger.</p>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setRefundId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" disabled={busy} onClick={() => void confirmRefund()}>
              Confirm refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ShopPaymentsPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <Body accessToken={token} />}
    </SalonManagementGate>
  );
}
