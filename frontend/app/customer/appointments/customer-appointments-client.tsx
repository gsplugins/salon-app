"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Calendar, Star } from "lucide-react";
import { formatCustomerWhen } from "@/lib/customer-portal-utils";
import {
  bookingServicesLabel,
  createCustomerBookingPayment,
  createCustomerReview,
  fetchCustomerAppointments,
  fetchCustomerReviews,
  formatApiError,
  patchCustomerBooking,
  type BookingRow,
  type CustomerReviewRow,
} from "@/lib/salon-api";
import { useSalonAccessToken } from "@/hooks/use-salon-access-token";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function buildRebookHref(b: BookingRow): string | null {
  const slug = b.shop?.slug;
  if (!slug) return null;
  const params = new URLSearchParams();
  const lineItemIds = (b.line_items ?? []).map((i) => i.service_id).filter((id) => Number.isFinite(id));
  const serviceIds = lineItemIds.length > 0 ? lineItemIds : [b.service.id];
  for (const id of serviceIds) params.append("service_id", String(id));
  if (Number.isFinite(b.staff.id)) params.set("staff_id", String(b.staff.id));
  return `/s/${slug}/book?${params.toString()}`;
}

export function CustomerAppointmentsClient() {
  const token = useSalonAccessToken();
  const [bookings, setBookings] = useState<BookingRow[] | null>(null);
  const [busy, setBusy] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [reviewRows, setReviewRows] = useState<CustomerReviewRow[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<number, { rating: number; comment: string }>>({});
  const [reviewBusyId, setReviewBusyId] = useState<number | null>(null);
  const [payFor, setPayFor] = useState<BookingRow | null>(null);
  const [payMethod, setPayMethod] = useState<"manual" | "bkash">("manual");
  const [tipTaka, setTipTaka] = useState("0");
  const [trxId, setTrxId] = useState("");
  const [payBusy, setPayBusy] = useState(false);
  const [asOf] = useState(() => new Date());

  const load = useCallback(async () => {
    if (!token) return;
    setBusy(true);
    const [res, reviewRes] = await Promise.all([fetchCustomerAppointments(token), fetchCustomerReviews(token)]);
    setBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      setBookings([]);
      return;
    }
    if (reviewRes.ok) setReviewRows(reviewRes.data);
    setBookings(res.data);
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function cancelBooking(id: number) {
    if (!token) return;
    if (!confirm("Cancel this appointment? The salon will see it as cancelled.")) return;
    setCancellingId(id);
    const res = await patchCustomerBooking(token, id, { status: "cancelled" });
    setCancellingId(null);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Booking cancelled.");
    void load();
  }

  async function markCompleted(id: number) {
    if (!token) return;
    if (!confirm("Mark this visit as completed?")) return;
    setCancellingId(id);
    const res = await patchCustomerBooking(token, id, { status: "completed" });
    setCancellingId(null);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Marked completed.");
    void load();
  }

  function canMarkCompleted(b: BookingRow): boolean {
    if (b.status !== "confirmed") return false;
    return new Date(b.starts_at) <= new Date();
  }

  function reviewedForBooking(bookingId: number): CustomerReviewRow | undefined {
    return reviewRows.find((r) => r.booking_id === bookingId);
  }

  async function submitReview(bookingId: number) {
    if (!token) return;
    const draft = reviewDrafts[bookingId] ?? { rating: 5, comment: "" };
    if (!draft.rating || draft.rating < 1 || draft.rating > 5) {
      toast.error("Please pick a star rating.");
      return;
    }
    setReviewBusyId(bookingId);
    const res = await createCustomerReview(token, bookingId, { rating: draft.rating, comment: draft.comment.trim() || null });
    setReviewBusyId(null);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Thanks for reviewing your barber.");
    setReviewRows((prev) => [res.data, ...prev]);
  }

  async function submitPayment() {
    if (!token || !payFor) return;
    const tip = Math.max(0, Math.round((Number.parseFloat(tipTaka || "0") || 0) * 100));
    setPayBusy(true);
    const res = await createCustomerBookingPayment(token, payFor.id, {
      method: payMethod,
      tip_cents: tip,
      trx_id: payMethod === "bkash" ? trxId.trim() || null : null
    });
    setPayBusy(false);
    if (!res.ok) {
      toast.error(formatApiError(res.body));
      return;
    }
    toast.success("Payment submitted successfully.");
    setPayFor(null);
    setTipTaka("0");
    setTrxId("");
    void load();
  }

  if (!token) return null;

  if (busy || bookings === null) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const upcoming = bookings.filter((b) => new Date(b.starts_at) >= asOf && b.status !== "cancelled");
  const past = bookings.filter((b) => new Date(b.starts_at) < asOf || b.status === "cancelled");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">Bookings</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Upcoming and past appointments.</p>
      </div>

      <section aria-labelledby="up-heading">
        <h2 id="up-heading" className="text-lg font-semibold text-zinc-900 dark:text-white">
          Upcoming
        </h2>
        {upcoming.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon={Calendar}
              title="No upcoming visits"
              description="Book a shop from the directory."
              action={
                <Button asChild className="min-h-11">
                  <Link href="/shops">Browse shops</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
            {upcoming.map((b) => {
              const rebookHref = buildRebookHref(b);
              return (
                <li key={b.id} className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
                  <p className="font-medium text-zinc-900 dark:text-white">{bookingServicesLabel(b)}</p>
                  <p className="text-sm text-zinc-500">{formatCustomerWhen(b.starts_at)}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {b.shop?.name ?? "Shop"} · {b.staff.name}
                  </p>
                  <p className="mt-1 text-xs capitalize text-zinc-500">{b.status}</p>
                  {(b.status === "pending" || b.status === "confirmed") && b.shop?.slug ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {rebookHref ? (
                        <Link
                          href={rebookHref}
                          className="inline-flex min-h-11 items-center rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-800 dark:border-zinc-600 dark:text-zinc-200"
                        >
                          Rebook same services
                        </Link>
                      ) : null}
                      {canMarkCompleted(b) ? (
                        <button
                          type="button"
                          disabled={cancellingId === b.id}
                          onClick={() => void markCompleted(b.id)}
                          className="inline-flex min-h-11 items-center rounded-full border border-emerald-600 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 disabled:opacity-50 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
                        >
                          {cancellingId === b.id ? "Saving…" : "Mark completed"}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={cancellingId === b.id}
                        onClick={() => void cancelBooking(b.id)}
                        className="inline-flex min-h-11 items-center rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
                      >
                        {cancellingId === b.id ? "Cancelling…" : "Cancel booking"}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="past-heading">
        <h2 id="past-heading" className="text-lg font-semibold text-zinc-900 dark:text-white">
          Past
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No past appointments.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {past.slice(0, 40).map((b) => (
              <li
                key={b.id}
                className="rounded-2xl border border-zinc-200 bg-white p-4 opacity-90 dark:border-zinc-800 dark:bg-zinc-900/50"
              >
                <p className="font-medium text-zinc-900 dark:text-white">{bookingServicesLabel(b)}</p>
                <p className="text-sm text-zinc-500">{formatCustomerWhen(b.starts_at)}</p>
                <p className="text-xs text-zinc-500">
                  {b.shop?.name ?? "Shop"} · {b.staff.name}
                </p>
                <p className="text-xs capitalize text-zinc-500">{b.status}</p>
                {b.payment ? (
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-300">
                    Paid: {(b.payment.amount_cents / 100).toFixed(2)} {b.payment.currency}
                    {b.payment.tip_cents > 0 ? ` (tip ${(b.payment.tip_cents / 100).toFixed(2)})` : ""}
                  </p>
                ) : null}
                {b.status === "completed" ? (
                  <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-900">
                    {!b.payment ? (
                      <div className="mb-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPayFor(b);
                            setPayMethod("manual");
                            setTipTaka("0");
                            setTrxId("");
                          }}
                          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white dark:bg-rose-100 dark:text-zinc-900"
                        >
                          Pay now (manual / bKash + tip)
                        </button>
                      </div>
                    ) : null}
                    {reviewedForBooking(b.id) ? (
                      <div>
                        <p className="inline-flex items-center gap-1 text-sm font-medium text-amber-600 dark:text-amber-300">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${i < Number(reviewedForBooking(b.id)?.rating ?? 0) ? "fill-amber-400" : "text-zinc-300 dark:text-zinc-600"}`}
                            />
                          ))}
                        </p>
                        {reviewedForBooking(b.id)?.comment ? (
                          <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">{reviewedForBooking(b.id)?.comment}</p>
                        ) : null}
                        <p className="mt-1 text-xs text-zinc-500">Your review is visible to the shop manager and barber profile.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-zinc-600 dark:text-zinc-300">Rate your barber</p>
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, i) => {
                            const value = i + 1;
                            const draft = reviewDrafts[b.id] ?? { rating: 5, comment: "" };
                            return (
                              <button
                                key={value}
                                type="button"
                                onClick={() => setReviewDrafts((prev) => ({ ...prev, [b.id]: { ...draft, rating: value } }))}
                                className="rounded p-1"
                                aria-label={`${value} stars`}
                              >
                                <Star
                                  className={`h-5 w-5 ${value <= draft.rating ? "fill-amber-400 text-amber-500" : "text-zinc-300 dark:text-zinc-600"}`}
                                />
                              </button>
                            );
                          })}
                        </div>
                        <textarea
                          rows={2}
                          value={reviewDrafts[b.id]?.comment ?? ""}
                          onChange={(e) =>
                            setReviewDrafts((prev) => ({
                              ...prev,
                              [b.id]: { rating: prev[b.id]?.rating ?? 5, comment: e.target.value },
                            }))
                          }
                          placeholder="Write about service quality, behavior, and experience…"
                          className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                        />
                        <button
                          type="button"
                          onClick={() => void submitReview(b.id)}
                          disabled={reviewBusyId === b.id}
                          className="rounded-lg bg-zinc-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-rose-100 dark:text-zinc-900"
                        >
                          {reviewBusyId === b.id ? "Submitting…" : "Submit review"}
                        </button>
                      </div>
                    )}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={payFor !== null} onOpenChange={(o) => !o && setPayFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete payment</DialogTitle>
          </DialogHeader>
          {payFor ? (
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-zinc-500">Booking:</span> {bookingServicesLabel(payFor)}
              </p>
              <p>
                <span className="text-zinc-500">Shop:</span> {payFor.shop?.name ?? "Shop"}
              </p>
              <div>
                <Label htmlFor="pay-method">Method</Label>
                <select
                  id="pay-method"
                  className="mt-1 h-10 w-full rounded-lg border border-zinc-200 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value as "manual" | "bkash")}
                >
                  <option value="manual">Manual (cash/card at salon)</option>
                  <option value="bkash">bKash</option>
                </select>
              </div>
              <div>
                <Label htmlFor="tip">Tip amount (BDT)</Label>
                <Input id="tip" className="mt-1" value={tipTaka} onChange={(e) => setTipTaka(e.target.value)} />
              </div>
              {payMethod === "bkash" ? (
                <div>
                  <Label htmlFor="trx">bKash transaction ID</Label>
                  <Input id="trx" className="mt-1" value={trxId} onChange={(e) => setTrxId(e.target.value)} placeholder="Optional but recommended" />
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPayFor(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={payBusy} onClick={() => void submitPayment()}>
              {payBusy ? "Saving..." : "Pay now"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
