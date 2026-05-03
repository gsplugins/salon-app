import { supabaseAdmin } from "../lib/supabase";

export type BookingLineItemJson = {
  service_id: number;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
};

export type BookingRowJson = Record<string, unknown>;

const BOOKING_CORE_SELECT =
  "id,customer_name,customer_mobile,starts_at,ends_at,status,source,notes,shop_id,salon_service_id,salon_staff_id,line_items,total_price_cents,advance_percent_snapshot,advance_amount_cents,advance_paid_cents";

type BookingCoreRow = {
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

type PaymentRow = {
  id: number;
  salon_booking_id: number;
  method: string;
  amount_cents: number;
  currency: string;
  status: string;
  transaction_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ReviewRow = {
  id: number;
  salon_booking_id: number;
  rating: number;
  comment: string | null;
  owner_reply: string | null;
  created_at: string | null;
};

function lineItemsFromRow(row: BookingCoreRow): BookingLineItemJson[] {
  const rawItems = row.line_items;
  if (!Array.isArray(rawItems)) return [];
  return rawItems.map((x) => {
    const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
    return {
      service_id: Number(o.service_id),
      name: String(o.name ?? ""),
      duration_minutes: Number(o.duration_minutes ?? 0),
      price_cents: o.price_cents == null ? null : Number(o.price_cents)
    };
  });
}

function shapeBookingJson(
  row: BookingCoreRow,
  shop: { id: number; name: string; slug: string } | null,
  svc: { id: number; name: string; category: string | null; duration_minutes: number; price_cents: number | null } | null,
  st: { id: number; name: string } | null,
  payment: PaymentRow | null,
  review: ReviewRow | null
): BookingRowJson {
  const lineItems = lineItemsFromRow(row);
  const primarySvc = svc
    ? {
        id: svc.id,
        name: svc.name,
        category: svc.category ?? null,
        duration_minutes: svc.duration_minutes,
        price_cents: svc.price_cents ?? null
      }
    : { id: row.salon_service_id, name: "", category: null, duration_minutes: 0, price_cents: null };

  return {
    id: row.id,
    customer_name: row.customer_name,
    customer_mobile: row.customer_mobile,
    shop: shop ? { id: shop.id, name: shop.name, slug: shop.slug } : null,
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
    staff: st ? { id: st.id, name: st.name } : { id: row.salon_staff_id, name: "" },
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    source: row.source,
    notes: row.notes,
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

/**
 * Load many bookings with a bounded number of Supabase round-trips (batch lookups).
 * Prefer this over calling {@link bookingToRow} in a loop — that pattern was N×5+ queries.
 */
export async function bookingsToRows(bookingIds: number[]): Promise<BookingRowJson[]> {
  const ids = [...new Set(bookingIds)].filter((id) => Number.isFinite(id) && id > 0);
  if (!ids.length) return [];

  const bookingsRes = await supabaseAdmin.from("salon_bookings").select(BOOKING_CORE_SELECT).in("id", ids);
  const bookingRows = (bookingsRes.data ?? []) as BookingCoreRow[];
  if (!bookingRows.length) return [];

  const shopIds = [...new Set(bookingRows.map((r) => r.shop_id))];
  const serviceIds = [...new Set(bookingRows.map((r) => r.salon_service_id))];
  const staffIds = [...new Set(bookingRows.map((r) => r.salon_staff_id))];

  const [shopsRes, servicesRes, staffRes, paymentsRes, reviewsRes] = await Promise.all([
    shopIds.length
      ? supabaseAdmin.from("shops").select("id,name,slug").in("id", shopIds)
      : Promise.resolve({ data: [] as { id: number; name: string; slug: string }[] }),
    serviceIds.length
      ? supabaseAdmin
          .from("salon_services")
          .select("id,name,category,duration_minutes,price_cents")
          .in("id", serviceIds)
      : Promise.resolve({ data: [] as { id: number; name: string; category: string | null; duration_minutes: number; price_cents: number | null }[] }),
    staffIds.length
      ? supabaseAdmin.from("salon_staff").select("id,name").in("id", staffIds)
      : Promise.resolve({ data: [] as { id: number; name: string }[] }),
    supabaseAdmin
      .from("salon_payments")
      .select("id,salon_booking_id,method,amount_cents,currency,status,transaction_id,metadata,created_at")
      .in("salon_booking_id", ids)
      .order("id", { ascending: false }),
    supabaseAdmin
      .from("salon_reviews")
      .select("id,salon_booking_id,rating,comment,owner_reply,created_at")
      .in("salon_booking_id", ids)
      .order("created_at", { ascending: false })
  ]);

  const shopMap = new Map<number, { id: number; name: string; slug: string }>();
  for (const s of (shopsRes.data ?? []) as { id: number; name: string; slug: string }[]) shopMap.set(s.id, s);

  const serviceMap = new Map<number, { id: number; name: string; category: string | null; duration_minutes: number; price_cents: number | null }>();
  for (const s of (servicesRes.data ?? []) as {
    id: number;
    name: string;
    category: string | null;
    duration_minutes: number;
    price_cents: number | null;
  }[]) {
    serviceMap.set(s.id, s);
  }

  const staffMap = new Map<number, { id: number; name: string }>();
  for (const s of (staffRes.data ?? []) as { id: number; name: string }[]) staffMap.set(s.id, s);

  const latestPaymentByBooking = new Map<number, PaymentRow>();
  for (const p of (paymentsRes.data ?? []) as PaymentRow[]) {
    if (!latestPaymentByBooking.has(p.salon_booking_id)) latestPaymentByBooking.set(p.salon_booking_id, p);
  }

  const latestReviewByBooking = new Map<number, ReviewRow>();
  for (const r of (reviewsRes.data ?? []) as ReviewRow[]) {
    if (!latestReviewByBooking.has(r.salon_booking_id)) latestReviewByBooking.set(r.salon_booking_id, r);
  }

  const byId = new Map<number, BookingCoreRow>();
  for (const r of bookingRows) byId.set(r.id, r);

  const ordered: BookingRowJson[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    ordered.push(
      shapeBookingJson(
        row,
        shopMap.get(row.shop_id) ?? null,
        serviceMap.get(row.salon_service_id) ?? null,
        staffMap.get(row.salon_staff_id) ?? null,
        latestPaymentByBooking.get(row.id) ?? null,
        latestReviewByBooking.get(row.id) ?? null
      )
    );
  }
  return ordered;
}

export async function bookingToRow(bookingId: number): Promise<BookingRowJson | null> {
  const rows = await bookingsToRows([bookingId]);
  return rows[0] ?? null;
}
