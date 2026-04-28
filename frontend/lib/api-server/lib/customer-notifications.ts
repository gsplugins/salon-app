import { supabaseAdmin } from "./supabase";

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

function bookingStatusLabel(status: string): string {
  const s = String(status ?? "").trim().toLowerCase();
  if (!s) return "Updated";
  return s
    .split("_")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export async function notifyCustomerBookingStatusChange(args: {
  bookingId: number;
  fromStatus: string;
  toStatus: string;
}): Promise<void> {
  const { bookingId, fromStatus, toStatus } = args;
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
    if (!booking.customer_user_id && !booking.customer_mobile) return;

    const shopRes = await supabaseAdmin.from("shops").select("name").eq("id", booking.shop_id).maybeSingle();
    const shopName = (shopRes.data as { name: string } | null)?.name ?? "Your shop";
    const startsLabel = new Date(booking.starts_at).toLocaleString();

    await supabaseAdmin.from("customer_notifications").insert({
      customer_user_id: booking.customer_user_id,
      customer_mobile: booking.customer_mobile,
      shop_id: booking.shop_id,
      salon_booking_id: booking.id,
      type: "booking_status_changed",
      title: "Booking status updated",
      body: `${shopName} changed your booking status from ${bookingStatusLabel(fromStatus)} to ${bookingStatusLabel(toStatus)} (${startsLabel}).`,
      metadata: {
        booking_id: booking.id,
        from_status: fromStatus,
        to_status: toStatus
      },
      is_read: false
    });
  } catch {
    // Do not block booking updates if notification delivery fails.
  }
}

export async function notifyCustomerReviewReply(args: {
  reviewId: number;
  ownerReply: string;
  actorName?: string | null;
}): Promise<void> {
  const { reviewId, ownerReply, actorName } = args;
  try {
    const reviewRes = await supabaseAdmin
      .from("salon_reviews")
      .select("id,shop_id,salon_booking_id,customer_user_id,salon_staff_id")
      .eq("id", reviewId)
      .maybeSingle();
    const review = reviewRes.data as
      | {
          id: number;
          shop_id: number;
          salon_booking_id: number | null;
          customer_user_id: string | null;
          salon_staff_id: number | null;
        }
      | null;
    if (!review) return;

    let customerMobile: string | null = null;
    if (review.salon_booking_id) {
      const bk = await supabaseAdmin
        .from("salon_bookings")
        .select("customer_mobile")
        .eq("id", review.salon_booking_id)
        .maybeSingle();
      customerMobile = ((bk.data as { customer_mobile: string | null } | null)?.customer_mobile ?? null) || null;
    }

    if (!review.customer_user_id && !customerMobile) return;

    const shopRes = await supabaseAdmin.from("shops").select("name").eq("id", review.shop_id).maybeSingle();
    const shopName = (shopRes.data as { name: string } | null)?.name ?? "Your salon";
    let staffName = "our team";
    if (review.salon_staff_id) {
      const staffRes = await supabaseAdmin.from("salon_staff").select("name").eq("id", review.salon_staff_id).maybeSingle();
      staffName = (staffRes.data as { name: string } | null)?.name ?? staffName;
    }
    const who = actorName?.trim() || "Salon manager";

    await supabaseAdmin.from("customer_notifications").insert({
      customer_user_id: review.customer_user_id,
      customer_mobile: customerMobile,
      shop_id: review.shop_id,
      salon_booking_id: review.salon_booking_id,
      type: "review_reply",
      title: "Reply on your review",
      body: `${who} from ${shopName} replied to your review for ${staffName}.`,
      metadata: {
        review_id: review.id,
        owner_reply: ownerReply
      },
      is_read: false
    });
  } catch {
    // Do not block review reply updates if notification delivery fails.
  }
}

export async function notifyCustomerStatusChange(args: {
  shopId: number;
  customerMobile: string;
  action: "suspend" | "unsuspend" | "remove" | "restore";
  note?: string | null;
}): Promise<void> {
  const { shopId, customerMobile, action, note } = args;
  try {
    const userRes = await supabaseAdmin.from("users").select("id").eq("mobile", customerMobile).maybeSingle();
    const userId = (userRes.data as { id: string } | null)?.id ?? null;
    if (!userId && !customerMobile) return;

    const shopRes = await supabaseAdmin.from("shops").select("name").eq("id", shopId).maybeSingle();
    const shopName = (shopRes.data as { name: string } | null)?.name ?? "your salon";
    const actionMap: Record<string, { title: string; body: string }> = {
      suspend: {
        title: "Account suspended in shop",
        body: `Your booking access has been suspended in ${shopName}. Contact the salon for support.`
      },
      unsuspend: {
        title: "Suspension removed",
        body: `Your booking access has been restored in ${shopName}.`
      },
      remove: {
        title: "Removed from shop",
        body: `Your customer profile has been removed from ${shopName}. Contact the salon if this is unexpected.`
      },
      restore: {
        title: "Customer profile restored",
        body: `Your customer profile has been restored in ${shopName}.`
      }
    };
    const msg = actionMap[action];
    await supabaseAdmin.from("customer_notifications").insert({
      customer_user_id: userId,
      customer_mobile: customerMobile,
      shop_id: shopId,
      salon_booking_id: null,
      type: "customer_status_change",
      title: msg.title,
      body: msg.body,
      metadata: {
        action,
        note: note ?? null
      },
      is_read: false
    });
  } catch {
    // Do not block customer status updates if notification delivery fails.
  }
}

