import { supabaseAdmin } from "./supabase";
import { normalizeMobile } from "./mobile";

const IN_CHUNK = 200;

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

async function deletePaymentsForBookingIds(bookingIds: number[]): Promise<void> {
  for (const part of chunks(bookingIds, IN_CHUNK)) {
    if (!part.length) continue;
    await supabaseAdmin.from("salon_payments").delete().in("salon_booking_id", part);
  }
}

async function deleteReviewsForBookingIds(bookingIds: number[]): Promise<void> {
  for (const part of chunks(bookingIds, IN_CHUNK)) {
    if (!part.length) continue;
    await supabaseAdmin.from("salon_reviews").delete().in("salon_booking_id", part);
  }
}

async function deleteCustomerNotificationsForBookingIds(bookingIds: number[]): Promise<void> {
  for (const part of chunks(bookingIds, IN_CHUNK)) {
    if (!part.length) continue;
    await supabaseAdmin.from("customer_notifications").delete().in("salon_booking_id", part);
  }
}

async function deleteBookingsByIds(bookingIds: number[]): Promise<void> {
  for (const part of chunks(bookingIds, IN_CHUNK)) {
    if (!part.length) continue;
    await supabaseAdmin.from("salon_bookings").delete().in("id", part);
  }
}

/** Deletes all rows tied to a single shop (not the `shops` row). Safe to call before deleting the shop record. */
export async function purgeShopTenantData(shopId: number): Promise<void> {
  const bookingsRes = await supabaseAdmin.from("salon_bookings").select("id").eq("shop_id", shopId).limit(50_000);
  const bookingIds = ((bookingsRes.data ?? []) as { id: number }[]).map((r) => r.id);

  await supabaseAdmin.from("salon_payments").delete().eq("shop_id", shopId);
  await deleteCustomerNotificationsForBookingIds(bookingIds);
  await supabaseAdmin.from("customer_notifications").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("salon_reviews").delete().eq("shop_id", shopId);
  await deleteBookingsByIds(bookingIds);

  const staffRes = await supabaseAdmin.from("salon_staff").select("id").eq("shop_id", shopId).limit(10_000);
  const staffIds = ((staffRes.data ?? []) as { id: number }[]).map((r) => r.id);
  for (const part of chunks(staffIds, IN_CHUNK)) {
    if (!part.length) continue;
    await supabaseAdmin.from("staff_notifications").delete().in("salon_staff_id", part);
    await supabaseAdmin.from("staff_leave_requests").delete().in("salon_staff_id", part);
    await supabaseAdmin.from("staff_customer_notes").delete().in("salon_staff_id", part);
  }

  await supabaseAdmin.from("salon_blocked_slots").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("queue_entries").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("waitlist").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("shop_customer_controls").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("shop_customers").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("salon_service_inventory").delete().eq("shop_id", shopId);
  for (const part of chunks(staffIds, IN_CHUNK)) {
    if (!part.length) continue;
    await supabaseAdmin.from("salon_staff_services").delete().in("staff_id", part);
  }
  await supabaseAdmin.from("salon_services").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("salon_staff").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("inventory_items").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("bkash_payments").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("subscriptions").delete().eq("shop_id", shopId);
  await supabaseAdmin.from("shop_members").delete().eq("shop_id", shopId);
}

/** Post-order list: branches first, root last — correct order to delete `shops` rows. */
export async function shopIdsPostOrderForDelete(rootShopId: number): Promise<number[]> {
  const ordered: number[] = [];
  async function walk(id: number): Promise<void> {
    const kids = await supabaseAdmin.from("shops").select("id").eq("parent_shop_id", id).limit(5000);
    for (const row of (kids.data ?? []) as { id: number }[]) {
      await walk(row.id);
    }
    ordered.push(id);
  }
  await walk(rootShopId);
  return ordered;
}

/** Removes tenant data and shop rows for a shop and any branches (`parent_shop_id`). */
export async function purgeShopTree(rootShopId: number): Promise<void> {
  const order = await shopIdsPostOrderForDelete(rootShopId);
  for (const id of order) {
    await purgeShopTenantData(id);
    await supabaseAdmin.from("shops").delete().eq("id", id);
  }
}

/**
 * Hard-removes a customer's footprint for one shop: bookings, payments, reviews, waitlist, queue,
 * staff notes, notifications, and shop link rows.
 */
export async function purgeCustomerDataFromShop(shopId: number, customerMobileRaw: string): Promise<void> {
  const customerMobile = normalizeMobile(customerMobileRaw) || customerMobileRaw.trim();
  if (!customerMobile) return;

  const userRes = await supabaseAdmin.from("users").select("id").eq("mobile", customerMobile).maybeSingle();
  const customerUserId = (userRes.data as { id: string } | null)?.id ?? null;

  let bq = supabaseAdmin.from("salon_bookings").select("id").eq("shop_id", shopId);
  if (customerUserId) {
    bq = bq.or(`customer_mobile.eq.${customerMobile},customer_user_id.eq.${customerUserId}`);
  } else {
    bq = bq.eq("customer_mobile", customerMobile);
  }
  const bookingsRes = await bq.limit(50_000);
  const bookingIds = ((bookingsRes.data ?? []) as { id: number }[]).map((r) => r.id);

  await deletePaymentsForBookingIds(bookingIds);
  await deleteReviewsForBookingIds(bookingIds);
  await deleteCustomerNotificationsForBookingIds(bookingIds);
  await deleteBookingsByIds(bookingIds);

  if (customerUserId) {
    await supabaseAdmin.from("salon_reviews").delete().eq("shop_id", shopId).eq("customer_user_id", customerUserId);
    await supabaseAdmin
      .from("customer_notifications")
      .delete()
      .eq("shop_id", shopId)
      .or(`customer_mobile.eq.${customerMobile},customer_user_id.eq.${customerUserId}`);
  } else {
    await supabaseAdmin.from("customer_notifications").delete().eq("shop_id", shopId).eq("customer_mobile", customerMobile);
  }

  if (customerUserId) {
    await supabaseAdmin.from("waitlist").delete().eq("shop_id", shopId).or(`customer_id.eq.${customerUserId},customer_mobile.eq.${customerMobile}`);
    await supabaseAdmin
      .from("queue_entries")
      .delete()
      .eq("shop_id", shopId)
      .or(`customer_user_id.eq.${customerUserId},customer_mobile.eq.${customerMobile}`);
  } else {
    await supabaseAdmin.from("waitlist").delete().eq("shop_id", shopId).eq("customer_mobile", customerMobile);
    await supabaseAdmin.from("queue_entries").delete().eq("shop_id", shopId).eq("customer_mobile", customerMobile);
  }

  const staffRes = await supabaseAdmin.from("salon_staff").select("id").eq("shop_id", shopId).limit(10_000);
  const staffIds = ((staffRes.data ?? []) as { id: number }[]).map((r) => r.id);
  for (const part of chunks(staffIds, IN_CHUNK)) {
    if (!part.length) continue;
    await supabaseAdmin.from("staff_customer_notes").delete().in("salon_staff_id", part).eq("customer_mobile", customerMobile);
  }
}

/** Deletes a staff member and all dependent rows (including their bookings for this shop). */
export async function purgeSalonStaffAndRelated(shopId: number, staffId: number): Promise<void> {
  const owns = await supabaseAdmin.from("salon_staff").select("id").eq("id", staffId).eq("shop_id", shopId).maybeSingle();
  if (!owns.data) return;

  const bookingsRes = await supabaseAdmin.from("salon_bookings").select("id").eq("shop_id", shopId).eq("salon_staff_id", staffId).limit(50_000);
  const bookingIds = ((bookingsRes.data ?? []) as { id: number }[]).map((r) => r.id);

  await deletePaymentsForBookingIds(bookingIds);
  await deleteReviewsForBookingIds(bookingIds);
  await deleteCustomerNotificationsForBookingIds(bookingIds);
  await deleteBookingsByIds(bookingIds);

  await supabaseAdmin.from("salon_reviews").delete().eq("shop_id", shopId).eq("salon_staff_id", staffId);
  await supabaseAdmin.from("staff_notifications").delete().eq("salon_staff_id", staffId);
  await supabaseAdmin.from("staff_leave_requests").delete().eq("salon_staff_id", staffId);
  await supabaseAdmin.from("staff_customer_notes").delete().eq("salon_staff_id", staffId);
  await supabaseAdmin.from("salon_blocked_slots").delete().eq("salon_staff_id", staffId);
  await supabaseAdmin.from("waitlist").update({ staff_id: null }).eq("shop_id", shopId).eq("staff_id", staffId);
  await supabaseAdmin.from("salon_staff_services").delete().eq("staff_id", staffId);
  await supabaseAdmin.from("salon_staff").delete().eq("id", staffId).eq("shop_id", shopId);
}
