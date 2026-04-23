"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { SuperAdminGate } from "@/components/auth/super-admin-gate";
import { AdminWorkspaceFrame } from "@/components/platform/admin-workspace-frame";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchBillingBkash,
  fetchBillingSalon,
  formatApiError,
  patchBkashRefund,
  patchSalonPaymentRefund,
  type Paginated,
} from "@/lib/admin-api";

function Body({ token }: { token: string }) {
  const [tab, setTab] = useState("bkash");
  const [bkash, setBkash] = useState<Paginated<Record<string, unknown>> | null>(null);
  const [salon, setSalon] = useState<Paginated<Record<string, unknown>> | null>(null);
  const [busy, setBusy] = useState(true);
  const [shopId, setShopId] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [refund, setRefund] = useState<{ kind: "bkash" | "salon"; id: number } | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    const opts = {
      shop_id: shopId ? Number(shopId) : undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
    };
    const [b, s] = await Promise.all([fetchBillingBkash(token, opts), fetchBillingSalon(token, opts)]);
    setBusy(false);
    if (!b.ok) toast.error(formatApiError(b.body));
    else setBkash(b.data);
    if (!s.ok) toast.error(formatApiError(s.body));
    else setSalon(s.data);
  }, [token, shopId, status, from, to]);

  useEffect(() => {
     
    void load();
  }, [load]);

  async function confirmRefund() {
    if (!refund) return;
    const res =
      refund.kind === "bkash"
        ? await patchBkashRefund(token, refund.id)
        : await patchSalonPaymentRefund(token, refund.id);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Marked as refunded.");
    setRefund(null);
    void load();
  }

  async function tryInvoice(id: number) {
    const res = await fetch(`/api/admin/billing/salon-payments/${id}/invoice`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 501) {
      const j = (await res.json()) as { message?: string };
      toast.message(j.message ?? "Invoice not available");
    } else if (!res.ok) {
      toast.error("Request failed");
    }
  }

  if (busy || !bkash || !salon) {
    return (
      <AdminWorkspaceFrame title="Billing" subtitle="Payments across channels.">
        <Skeleton className="h-56 w-full rounded-2xl" />
      </AdminWorkspaceFrame>
    );
  }

  const rows = tab === "bkash" ? bkash.data : salon.data;

  return (
    <AdminWorkspaceFrame
      title="Billing"
      subtitle="bKash ledger and in-app salon card payments. Filter by shop, status, and date. Refunds require confirmation."
    >
      <div className="mb-4 grid gap-3 lg:grid-cols-4">
        <div className="grid gap-1">
          <Label>Shop ID</Label>
          <Input value={shopId} onChange={(e) => setShopId(e.target.value)} inputMode="numeric" placeholder="optional" />
        </div>
        <div className="grid gap-1">
          <Label>Status</Label>
          <Input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. completed" />
        </div>
        <div className="grid gap-1">
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="flex items-end gap-2 lg:col-span-4">
          <Button type="button" onClick={() => void load()}>
            Apply
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="bkash">bKash</TabsTrigger>
          <TabsTrigger value="salon">Salon payments</TabsTrigger>
        </TabsList>
        <TabsContent value="bkash">
          <p className="mb-2 text-xs text-zinc-500">Stripe keys live under Integrations.</p>
        </TabsContent>
        <TabsContent value="salon">
          <p className="mb-2 text-xs text-zinc-500">PDF invoices are stubbed until a renderer is configured.</p>
        </TabsContent>
      </Tabs>

      <Table>
        <THead>
          <TR>
            <TH>ID</TH>
            <TH>When</TH>
            <TH>Shop</TH>
            <TH>Amount</TH>
            <TH>Status</TH>
            <TH className="text-right">Actions</TH>
          </TR>
        </THead>
        <TBody>
          {rows.map((r) => {
            const id = Number(r.id);
            const created = String(r.created_at ?? "");
            const st = String(r.status ?? "");
            const shop = (r.shop as { name?: string } | undefined)?.name ?? "—";
            const amt =
              tab === "bkash"
                ? `${(Number(r.amount_paisa ?? 0) / 100).toFixed(2)} BDT (paisa)`
                : `${(Number(r.amount_cents ?? 0) / 100).toFixed(2)} ${String(r.currency ?? "USD")}`;
            return (
              <TR key={id}>
                <TD className="font-mono text-xs">{id}</TD>
                <TD className="text-xs whitespace-nowrap">{new Date(created).toLocaleString()}</TD>
                <TD>{shop}</TD>
                <TD>{amt}</TD>
                <TD>{st}</TD>
                <TD className="text-right">
                  {st !== "refunded" ? (
                    <Button type="button" variant="outline" className="h-8 px-2 text-xs" onClick={() => setRefund({ kind: tab === "bkash" ? "bkash" : "salon", id })}>
                      Refund
                    </Button>
                  ) : null}
                  {tab === "salon" ? (
                    <Button type="button" variant="ghost" className="ml-1 h-8 px-2 text-xs" onClick={() => void tryInvoice(id)}>
                      Invoice
                    </Button>
                  ) : null}
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>

      <Dialog open={refund !== null} onOpenChange={(o) => !o && setRefund(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as refunded?</DialogTitle>
            <DialogDescription>Updates the payment status for reconciliation (no automatic gateway refund).</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRefund(null)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void confirmRefund()}>
              Confirm refund
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminWorkspaceFrame>
  );
}

export function AdminBillingClient() {
  return <SuperAdminGate>{(token) => <Body token={token} />}</SuperAdminGate>;
}
