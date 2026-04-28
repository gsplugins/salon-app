"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { formatApiError } from "@/lib/auth-api";
import { bookingStatusLabel, formatStaffDateTime } from "@/lib/staff-ui";
import {
  fetchStaffCustomerHistory,
  fetchStaffCustomerNotes,
  fetchStaffCustomers,
  postStaffCustomerNote,
  type StaffCustomerRow,
} from "@/lib/staff-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const noteSchema = z.object({
  note: z.string().min(1, "Write a note"),
});

type NoteForm = z.infer<typeof noteSchema>;

type HistoryRow = {
  id: number;
  starts_at: string;
  status: string;
  service: { name: string | null; duration_minutes: number; price_cents: number | null };
  notes: string | null;
};

export function StaffCustomersClient() {
  const token = useSalonAccessToken();
  const [rows, setRows] = useState<StaffCustomerRow[] | null>(null);
  const [openMobile, setOpenMobile] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryRow[] | null>(null);
  const [notes, setNotes] = useState<{ id: number; note: string; created_at: string | null }[] | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await fetchStaffCustomers(token);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setRows([]);
      return;
    }
    setRows(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const noteForm = useForm<NoteForm>({
    resolver: zodResolver(noteSchema) as Resolver<NoteForm>,
    defaultValues: { note: "" },
  });

  const openDetail = useCallback(
    async (mobile: string) => {
      if (!token) return;
      setOpenMobile(mobile);
      setDetailBusy(true);
      setHistory(null);
      setNotes(null);
      const [h, n] = await Promise.all([
        fetchStaffCustomerHistory(token, mobile),
        fetchStaffCustomerNotes(token, mobile),
      ]);
      setDetailBusy(false);
      if (!h.ok) toast.error(formatApiError(h.body));
      else setHistory(h.data as HistoryRow[]);
      if (!n.ok) toast.error(formatApiError(n.body));
      else setNotes(n.data);
    },
    [token]
  );

  async function submitNote(mobile: string, values: NoteForm) {
    if (!token) return;
    const res = await postStaffCustomerNote(token, { customer_mobile: mobile, note: values.note });
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Note saved.");
    noteForm.reset({ note: "" });
    void openDetail(mobile);
  }

  if (!token) return null;

  if (rows === null) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-800 dark:text-white">Customers</h1>
        <p className="mt-1 text-sm text-zinc-800 dark:text-zinc-400">People you have seen on your calendar (read-only profiles).</p>
      </div>
      <ul className="space-y-2">
        {rows.length === 0 ? (
          <li className="rounded-2xl border border-dashed border-zinc-200 p-6 text-center text-sm text-zinc-800 dark:border-zinc-700">
            No customers yet.
          </li>
        ) : (
          rows.map((r) => (
            <li key={r.customer_mobile}>
              <button
                type="button"
                onClick={() => void openDetail(r.customer_mobile)}
                className="flex w-full min-h-[52px] flex-col rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-left transition hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/40 dark:hover:bg-zinc-900/50"
              >
                <span className="font-medium text-zinc-800 dark:text-white">{r.customer_name}</span>
                <span className="text-sm text-zinc-800 dark:text-zinc-400">{r.customer_mobile}</span>
                <span className="mt-1 text-xs text-zinc-800">
                  {r.visit_count} visits · last {formatStaffDateTime(r.last_visit_at)}
                </span>
              </button>
            </li>
          ))
        )}
      </ul>

      <Dialog open={openMobile !== null} onOpenChange={(o) => !o && setOpenMobile(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer</DialogTitle>
          </DialogHeader>
          {openMobile ? (
            <div className="space-y-4 text-sm">
              <p className="font-mono text-xs text-zinc-800">{openMobile}</p>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-800">History with you</p>
                {detailBusy || history === null ? (
                  <Skeleton className="mt-2 h-24 w-full" />
                ) : history.length === 0 ? (
                  <p className="mt-2 text-zinc-800">No past visits.</p>
                ) : (
                  <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto">
                    {history.map((h) => (
                      <li key={h.id} className="rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800">
                        <p className="font-medium text-zinc-800 dark:text-white">{h.service?.name ?? "Service"}</p>
                        <p className="text-xs text-zinc-800">
                          {formatStaffDateTime(h.starts_at)} · {bookingStatusLabel(h.status)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-800">Internal notes</p>
                {notes === null ? (
                  <Skeleton className="mt-2 h-16 w-full" />
                ) : (
                  <ul className="mt-2 space-y-2">
                    {notes.map((n) => (
                      <li key={n.id} className="rounded-lg bg-zinc-50 px-3 py-2 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                        <p>{n.note}</p>
                        {n.created_at ? <p className="mt-1 text-[10px] text-zinc-800">{formatStaffDateTime(n.created_at)}</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
                <form className="mt-3 space-y-2" onSubmit={noteForm.handleSubmit((v) => void submitNote(openMobile, v))}>
                  <Label htmlFor="cust-note">Add note</Label>
                  <Textarea id="cust-note" className="min-h-[80px]" {...noteForm.register("note")} />
                  {noteForm.formState.errors.note ? (
                    <p className="text-xs text-red-600">{noteForm.formState.errors.note.message}</p>
                  ) : null}
                  <Button type="submit" className="min-h-11" disabled={noteForm.formState.isSubmitting}>
                    Save note
                  </Button>
                </form>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
