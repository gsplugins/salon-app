import { supabaseAdmin } from "../lib/supabase.js";

export type BookingRowJson = Record<string, unknown>;

export async function bookingToRow(bookingId: number): Promise<BookingRowJson | null> {
  const b = await supabaseAdmin
    .from("salon_bookings")
    .select(
      "id,customer_name,customer_mobile,starts_at,ends_at,status,source,notes,shop_id,salon_service_id,salon_staff_id"
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
  };
  const [shop, svc, st] = await Promise.all([
    supabaseAdmin.from("shops").select("id,name,slug").eq("id", row.shop_id).maybeSingle(),
    supabaseAdmin
      .from("salon_services")
      .select("id,name,category,duration_minutes,price_cents")
      .eq("id", row.salon_service_id)
      .maybeSingle(),
    supabaseAdmin.from("salon_staff").select("id,name").eq("id", row.salon_staff_id).maybeSingle()
  ]);
  return {
    id: row.id,
    customer_name: row.customer_name,
    customer_mobile: row.customer_mobile,
    shop: shop.data ? { id: (shop.data as { id: number }).id, name: (shop.data as { name: string }).name, slug: (shop.data as { slug: string }).slug } : null,
    service: svc.data
      ? {
          id: (svc.data as { id: number }).id,
          name: (svc.data as { name: string }).name,
          category: (svc.data as { category: string | null }).category ?? null,
          duration_minutes: (svc.data as { duration_minutes: number }).duration_minutes,
          price_cents: (svc.data as { price_cents: number | null }).price_cents ?? null
        }
      : { id: row.salon_service_id, name: "", category: null, duration_minutes: 0, price_cents: null },
    staff: st.data
      ? { id: (st.data as { id: number }).id, name: (st.data as { name: string }).name }
      : { id: row.salon_staff_id, name: "" },
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    status: row.status,
    source: row.source,
    notes: row.notes
  };
}
