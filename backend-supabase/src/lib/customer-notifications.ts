import { supabaseAdmin } from "./supabase.js";

export async function notifyCustomerBookingEvent(args: {
  bookingId: number;
  type: "booking_confirmed" | "service_completed_review";
}): Promise<void> {
  const { bookingId, type } = args;
  try {
    const bookingRes = await supabaseAdmin
      .from("salon_bookings")
      .select("id,shop_id,salon_staff_id,customer_user_id,customer_mobile,starts_at")
      .eq("id", bookingId)
      .maybeSingle();
    const booking = bookingRes.data as
      | {
          id: number;
          shop_id: number;
          salon_staff_id: number | null;
          customer_user_id: string | null;
          customer_mobile: string | null;
          starts_at: string;
        }
      | null;
    if (!booking) return;

    const hasRecipient = Boolean(booking.customer_user_id || booking.customer_mobile);
    if (!hasRecipient) return;

    const shopRes = await supabaseAdmin.from("shops").select("name").eq("id", booking.shop_id).maybeSingle();
    const shopName = (shopRes.data as { name: string } | null)?.name ?? "Your shop";
    let staffName = "your barber";
    if (booking.salon_staff_id) {
      const staffRes = await supabaseAdmin.from("salon_staff").select("name").eq("id", booking.salon_staff_id).maybeSingle();
      staffName = (staffRes.data as { name: string } | null)?.name ?? staffName;
    }

    const startsLabel = new Date(booking.starts_at).toLocaleString();
    const payload =
      type === "booking_confirmed"
        ? {
            title: "Booking confirmed",
            body: `${shopName} confirmed your appointment with ${staffName} on ${startsLabel}.`
          }
        : {
            title: "Service completed",
            body: `${shopName} marked your service as completed. Please rate ${staffName} and share your review.`
          };

    await supabaseAdmin.from("customer_notifications").insert({
      customer_user_id: booking.customer_user_id,
      customer_mobile: booking.customer_mobile,
      shop_id: booking.shop_id,
      salon_booking_id: booking.id,
      type,
      title: payload.title,
      body: payload.body,
      metadata: {
        booking_id: booking.id,
        next_action: type === "service_completed_review" ? "write_review" : null
      },
      is_read: false
    });
  } catch {
    // Do not block booking status updates if notification delivery fails.
  }
}
