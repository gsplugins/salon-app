import { supabaseAdmin } from "../lib/supabase";

export type BookingLineItemJson = {
  service_id: number;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
};

export type BookingRowJson = Record<string, unknown>;

export async function bookingToRow(bookingId: number): Promise<BookingRowJson | null> {
  const b = await supabaseAdmin
    .from("salon_bookings")
    .select(
      "id,customer_name,customer_mobile,starts_at,ends_at,status,source,notes,shop_id,salon_service_id,salon_staff_id,line_items,total_price_cents,advance_percent_snapshot,advance_amount_cents,advance_paid_cents"
    )
    .eq("id", bookingId)
    .maybeSingle();
  if (!b.data) return null;
  const row = b.data as {
    id: number;
    customer_name: string;
    customer_mobile: string;
    starts_at: string;
    ends_at: string;
    status: string;
    source: string;
    notes: string | null;
    shop_id: number;
    salon_service_id: number;
    salon_staff_id: number;
    line_items: unknown;
    total_price_cents: number | null;
    advance_percent_snapshot: number | null;
    advance_amount_cents: number | null;
    advance_paid_cents: number | null;
  };
  const rawItems = row.line_items;
  const lineItems: BookingLineItemJson[] = Array.isArray(rawItems)
    ? (rawItems as unknown[]).map((x) => {
        const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
        return {
          service_id: Number(o.service_id),
          name: String(o.name ?? ""),
          duration_minutes: Number(o.duration_minutes ?? 0),
          price_cents: o.price_cents == null ? null : Number(o.price_cents)
        };
      })
    : [];

  const [shop, svc, st] = await Promise.all([
    supabaseAdmin.from("shops").select("id,name,slug").eq("id", row.shop_id).maybeSingle(),
    supabaseAdmin
      .from("salon_services")
      .select("id,name,category,duration_minutes,price_cents")
      .eq("id", row.salon_service_id)
      .maybeSingle(),
    supabaseAdmin.from("salon_staff").select("id,name").eq("id", row.salon_staff_id).maybeSingle()
  ]);
  const paymentRes = await supabaseAdmin
    .from("salon_payments")
    .select("id,method,amount_cents,currency,status,transaction_id,metadata,created_at")
    .eq("salon_booking_id", row.id)
    .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payment = paymentRes.data as
    | {
        id: number;
        method: string;
        amount_cents: number;
        currency: string;
        status: string;
        transaction_id: string | null;
        metadata: Record<string, unknown> | null;
        created_at: string;
      }
    | null;
  const reviewRes = await supabaseAdmin
    .from("salon_reviews")
    .select("id,rating,comment,owner_reply,created_at")
    .eq("salon_booking_id", row.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const review = reviewRes.data as
    | { id: number; rating: number; comment: string | null; owner_reply: string | null; created_at: string | null }
    | null;

  const primarySvc = svc.data
    ? {
        id: (svc.data as { id: number }).id,
        name: (svc.data as { name: string }).name,
        category: (svc.data as { category: string | null }).category ?? null,
        duration_minutes: (svc.data as { duration_minutes: number }).duration_minutes,
        price_cents: (svc.data as { price_cents: number | null }).price_cents ?? null
      }
    : { id: row.salon_service_id, name: "", category: null, duration_minutes: 0, price_cents: null };

  return {
    id: row.id,
    customer_name: row.customer_name,
    customer_mobile: row.customer_mobile,
    shop: shop.data
      ? {
          id: (shop.data as { id: number }).id,
          name: (shop.data as { name: string }).name,
          slug: (shop.data as { slug: string }).slug
        }
      : null,
    service: primarySvc,
    line_items: lineItems.length
      ? lineItems
      : [
          {
            service_id: primarySvc.id,
            name: primarySvc.name,
            duration_minutes: primarySvc.duration_minutes,
            price_cents: primarySvc.price_cents
          }
        ],
    total_price_cents: row.total_price_cents,
    advance_percent_snapshot: row.advance_percent_snapshot ?? 0,
    advance_amount_cents: row.advance_amount_cents ?? 0,
    advance_paid_cents: row.advance_paid_cents ?? 0,
    staff: st.data
      ? { id: (st.data as { id: number }).id, name: (st.data as { name: string }).name }
      : { id: row.salon_staff_id, name: "" },
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    source: row.source,
    notes: row.notes
    ,
    payment: payment
      ? {
          id: payment.id,
          method: payment.method,
          amount_cents: payment.amount_cents,
          currency: payment.currency,
          status: payment.status,
          transaction_id: payment.transaction_id ?? null,
          tip_cents: Number((payment.metadata as { tip_cents?: unknown } | null)?.tip_cents ?? 0),
          created_at: payment.created_at
        }
      : null,
    review: review
      ? {
          id: review.id,
          rating: Number(review.rating),
          comment: review.comment ?? null,
          owner_reply: review.owner_reply ?? null,
          created_at: review.created_at ?? null
        }
      : null
  };
}

