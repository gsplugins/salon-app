"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { SalonManagementGate } from "@/components/auth/salon-management-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { fetchShopClients, formatApiError, type ShopClientRow } from "@/lib/salon-api";

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

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchShopClients(accessToken);
    setLoading(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    setRows(res.data);
  }, [accessToken]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- customer directory fetch
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
                <TH>Visits</TH>
                <TH>Last visit</TH>
              </TR>
            </THead>
            <TBody>
              {filtered.map((r) => (
                <TR key={r.customer_mobile}>
                  <TD className="font-medium">{r.customer_name || "—"}</TD>
                  <TD className="font-mono text-sm">{r.customer_mobile}</TD>
                  <TD>{r.visit_count}</TD>
                  <TD className="text-sm text-zinc-600 dark:text-zinc-400">
                    {new Date(r.last_visit_at).toLocaleString()}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
      <p className="text-xs text-zinc-500">
        Full customer profiles, internal notes, and loyalty balances need dedicated tables and APIs; this list is derived from booking history.
      </p>
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
