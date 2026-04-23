"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchShopCustomerDetails,
  fetchShopClients,
  formatApiError,
  patchShopCustomerStatus,
  type ShopClientRow,
  type ShopCustomerDetails,
} from "@/lib/salon-api";

function toCsv(rows: ShopClientRow[]): string {
  const header = ["customer_name", "customer_mobile", "visit_count", "last_visit_at"];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [header.join(",")];
  for (const r of rows) {
    lines.push(
      [r.customer_name, r.customer_mobile, String(r.visit_count), r.last_visit_at].map((c) => esc(String(c))).join(",")
    );
  }
  return lines.join("\n");
}

function Body({ accessToken }: { accessToken: string }) {
  const [rows, setRows] = useState<ShopClientRow[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showRemoved, setShowRemoved] = useState(false);
  const [selectedMobile, setSelectedMobile] = useState<string | null>(null);
  const [details, setDetails] = useState<ShopCustomerDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [statusNote, setStatusNote] = useState("");
  const [actionBusy, setActionBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchShopClients(accessToken, { include_removed: showRemoved });
    setLoading(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setRows(res.data);
  }, [accessToken, showRemoved]);

  useEffect(() => {
     
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return rows;
    return rows.filter(
      (r) =>
        r.customer_mobile.toLowerCase().includes(t) ||
        (r.customer_name && r.customer_name.toLowerCase().includes(t))
    );
  }, [rows, q]);

  const openCustomer = useCallback(
    async (mobile: string) => {
      setSelectedMobile(mobile);
      setDetailsLoading(true);
      setStatusNote("");
      const res = await fetchShopCustomerDetails(accessToken, mobile);
      setDetailsLoading(false);
      if (!res.ok) {
        toast.error(formatApiError(res.body));
        return;
      }
      setDetails(res.data);
    },
    [accessToken]
  );

  async function runAction(action: "suspend" | "unsuspend" | "remove" | "restore") {
    if (!selectedMobile) return;
    setActionBusy(true);
    const res = await patchShopCustomerStatus(accessToken, selectedMobile, {
      action,
      note: statusNote.trim() || null,
    });
    setActionBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Customer status updated.");
    await Promise.all([load(), openCustomer(selectedMobile)]);
  }

  function exportCsv() {
    const blob = new Blob([toCsv(filtered)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "customers.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Download started");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search name or mobile…" className="max-w-xs" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-300">
          <input type="checkbox" checked={showRemoved} onChange={(e) => setShowRemoved(e.target.checked)} />
          Show removed
        </label>
        <Button type="button" variant="outline" onClick={() => void load()}>
          Refresh
        </Button>
        <Button type="button" onClick={exportCsv}>
          Export CSV
        </Button>
      </div>
      {loading ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : (
        <div className="rounded-2xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900/40 [&>div]:rounded-2xl [&>div]:border-0">
          <Table>
            <THead>
              <TR>
                <TH>Name</TH>
                <TH>Mobile</TH>
                <TH>Last service</TH>
                <TH>Visits</TH>
                <TH>Last visit</TH>
                <TH>Status</TH>
                <TH className="text-right">Actions</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((r) => (
                <TR key={r.customer_mobile}>
                  <TD className="font-medium">{r.customer_name || "—"}</TD>
                  <TD className="font-mono text-sm">{r.customer_mobile}</TD>
                  <TD>{r.last_service_name ?? "—"}</TD>
                  <TD>{r.visit_count}</TD>
                  <TD className="text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(r.last_visit_at).toLocaleString()}
                  </TD>
                  <TD>
                    {r.is_removed ? "Removed" : r.is_suspended ? "Suspended" : "Active"}
                  </TD>
                  <TD className="text-right">
                    <Button type="button" variant="outline" onClick={() => void openCustomer(r.customer_mobile)}>
                      View
                    </Button>
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Customer status controls are shop-specific. Suspended/removed customers cannot create new public bookings for this shop.
      </p>

      <Dialog open={selectedMobile !== null} onOpenChange={(open) => !open && setSelectedMobile(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Customer details</DialogTitle>
            <DialogDescription>{selectedMobile ?? ""}</DialogDescription>
          </DialogHeader>
          {detailsLoading || !details ? (
            <Skeleton className="h-64 w-full rounded-xl" />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-2 rounded-xl border border-zinc-200 p-3 text-sm dark:border-zinc-800">
                <p>
                  <span className="font-medium">Name:</span> {details.customer_name ?? details.user?.name ?? "—"}
                </p>
                <p>
                  <span className="font-medium">Status:</span>{" "}
                  {details.is_removed ? "Removed" : details.is_suspended ? "Suspended" : "Active"}
                </p>
                <p>
                  <span className="font-medium">Account linked:</span> {details.user ? "Yes" : "No"}
                </p>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Shops this customer visited</h3>
                <ul className="space-y-2">
                  {details.shops.map((s) => (
                    <li key={`${s.shop_id}-${s.shop_slug}`} className="rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800">
                      {s.shop_name} ({s.shop_slug || "no-slug"}) · {s.visit_count} visits · last{" "}
                      {new Date(s.last_visit_at).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 text-sm font-semibold">Service history in current shop</h3>
                <Table>
                  <THead>
                    <TR>
                      <TH>Date</TH>
                      <TH>Service</TH>
                      <TH>Status</TH>
                      <TH>Duration</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {details.current_shop_service_history.map((h) => (
                      <TR key={h.booking_id}>
                        <TD>{new Date(h.starts_at).toLocaleString()}</TD>
                        <TD>{h.service_name ?? "—"}</TD>
                        <TD>{h.status}</TD>
                        <TD>{h.duration_minutes ?? "—"} min</TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>

              <div className="space-y-2 rounded-xl border border-zinc-200 p-3 dark:border-zinc-800">
                <Label htmlFor="status-note">Action note (optional)</Label>
                <Textarea id="status-note" rows={2} value={statusNote} onChange={(e) => setStatusNote(e.target.value)} />
                <div className="flex flex-wrap gap-2">
                  {details.is_suspended ? (
                    <Button type="button" variant="outline" disabled={actionBusy} onClick={() => void runAction("unsuspend")}>
                      Unsuspend
                    </Button>
                  ) : (
                    <Button type="button" variant="outline" disabled={actionBusy} onClick={() => void runAction("suspend")}>
                      Suspend
                    </Button>
                  )}
                  {details.is_removed ? (
                    <Button type="button" variant="outline" disabled={actionBusy} onClick={() => void runAction("restore")}>
                      Restore
                    </Button>
                  ) : (
                    <Button type="button" variant="destructive" disabled={actionBusy} onClick={() => void runAction("remove")}>
                      Remove from this shop
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedMobile(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ShopCustomersPageClient() {
  return (
    <SalonManagementGate>
      {(token) => <Body accessToken={token} />}
    </SalonManagementGate>
  );
}
