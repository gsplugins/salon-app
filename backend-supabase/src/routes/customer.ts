import type { Request, Response, Router } from "express";
import { z } from "zod";
import { verifyAccessToken } from "../lib/jwt.js";
import { supabaseAdmin } from "../lib/supabase.js";
import { fail, okData } from "../lib/http.js";
import { bookingToRow } from "../presenters/booking.js";

async function authUser(req: Request): Promise<{ id: string; mobile: string } | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try {
    const payload = verifyAccessToken(auth.slice("Bearer ".length).trim());
    const userRes = await supabaseAdmin.from("users").select("id,mobile").eq("id", payload.sub).maybeSingle();
    return (userRes.data as { id: string; mobile: string } | null) ?? null;
  } catch {
    return null;
  }
}

export function mountCustomerRoutes(router: Router): void {
  const waitlistJoinSchema = z.object({
    shop_id: z.number().int().positive(),
    service_id: z.number().int().positive(),
    preferred_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    staff_id: z.number().int().positive().nullable().optional()
  });

  router.post("/waitlist/join", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const parsed = waitlistJoinSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const shopOk = await supabaseAdmin.from("shops").select("id").eq("id", parsed.data.shop_id).eq("is_active", true).maybeSingle();
    if (!shopOk.data) return fail(res, 422, "Invalid shop.");

    const serviceOk = await supabaseAdmin
      .from("salon_services")
      .select("id")
      .eq("id", parsed.data.service_id)
      .eq("shop_id", parsed.data.shop_id)
      .eq("is_active", true)
      .maybeSingle();
    if (!serviceOk.data) return fail(res, 422, "Invalid service.");

    let staffId: number | null = parsed.data.staff_id ?? null;
    if (staffId != null) {
      const staffOk = await supabaseAdmin
        .from("salon_staff")
        .select("id")
        .eq("id", staffId)
        .eq("shop_id", parsed.data.shop_id)
        .eq("is_active", true)
        .maybeSingle();
      if (!staffOk.data) return fail(res, 422, "Invalid staff.");
    }

    const existing = await supabaseAdmin
      .from("waitlist")
      .select("id,status")
      .eq("shop_id", parsed.data.shop_id)
      .eq("service_id", parsed.data.service_id)
      .eq("preferred_date", parsed.data.preferred_date)
      .eq("customer_id", user.id)
      .in("status", ["waiting", "notified"])
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing.data) return fail(res, 409, "You are already on the waitlist for this request.");

    const ins = await supabaseAdmin
      .from("waitlist")
      .insert({
        shop_id: parsed.data.shop_id,
        service_id: parsed.data.service_id,
        staff_id: staffId,
        customer_id: user.id,
        customer_mobile: user.mobile,
        preferred_date: parsed.data.preferred_date,
        status: "waiting"
      })
      .select("id,shop_id,service_id,staff_id,preferred_date,status,notified_at,created_at")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not join waitlist.");
    return okData(res, ins.data, 201);
  });

  router.get("/waitlist/my", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const rows = await supabaseAdmin
      .from("waitlist")
      .select("id,shop_id,service_id,staff_id,preferred_date,status,notified_at,created_at")
      .or(`customer_id.eq.${user.id},customer_mobile.eq.${user.mobile}`)
      .order("created_at", { ascending: false })
      .limit(300);
    return okData(res, rows.data ?? []);
  });

  router.delete("/waitlist/:id", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return fail(res, 422, "Invalid waitlist id.");

    const existing = await supabaseAdmin.from("waitlist").select("id,customer_id,customer_mobile").eq("id", id).maybeSingle();
    const row = existing.data as { id: number; customer_id: string | null; customer_mobile: string | null } | null;
    if (!row) return fail(res, 404, "Not found.");
    if (row.customer_id !== user.id && row.customer_mobile !== user.mobile) return fail(res, 403, "Forbidden.");

    await supabaseAdmin.from("waitlist").update({ status: "cancelled" }).eq("id", id);
    return okData(res, { id, removed: true });
  });

  router.get("/me/appointments", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const rows = await supabaseAdmin
      .from("salon_bookings")
      .select("id")
      .or(`customer_user_id.eq.${user.id},customer_mobile.eq.${user.mobile}`)
      .order("starts_at", { ascending: false })
      .limit(300);
    const data = [];
    for (const row of (rows.data ?? []) as { id: number }[]) {
      const b = await bookingToRow(row.id);
      if (b) data.push(b);
    }
    return okData(res, data);
  });

  router.get("/me/loyalty", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const u = await supabaseAdmin.from("users").select("loyalty_points").eq("id", user.id).maybeSingle();
    const tx = await supabaseAdmin
      .from("loyalty_transactions")
      .select("id,points,type,description,created_at")
      .eq("user_id", user.id)
      .order("id", { ascending: false })
      .limit(100);
    return okData(res, {
      points: (u.data as { loyalty_points: number } | null)?.loyalty_points ?? 0,
      transactions: tx.data ?? []
    });
  });

  router.get("/me/reviews", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const rows = await supabaseAdmin
      .from("salon_reviews")
      .select("id,salon_booking_id,rating,comment,created_at,shop_id,salon_staff(name),shops(name,slug)")
      .eq("customer_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(300);
    const data = (rows.data ?? []).map(
      (r: {
        id: number;
        salon_booking_id: number | null;
        rating: number;
        comment: string | null;
        created_at: string | null;
        shop_id: number | null;
        salon_staff: { name: string }[] | null;
        shops: { name: string; slug: string }[] | null;
      }) => ({
        id: r.id,
        booking_id: r.salon_booking_id,
        rating: Number(r.rating),
        comment: r.comment ?? null,
        created_at: r.created_at ?? null,
        staff_name: r.salon_staff?.[0]?.name ?? null,
        shop: r.shop_id
          ? {
              id: r.shop_id,
              name: r.shops?.[0]?.name ?? "Shop",
              slug: r.shops?.[0]?.slug ?? null,
            }
          : null,
      })
    );
    return okData(res, data);
  });

  router.get("/me/notifications", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const rows = await supabaseAdmin
      .from("customer_notifications")
      .select("id,type,title,body,metadata,is_read,created_at,salon_booking_id")
      .or(`customer_user_id.eq.${user.id},customer_mobile.eq.${user.mobile}`)
      .order("created_at", { ascending: false })
      .limit(300);
    return okData(res, rows.data ?? []);
  });

  router.patch("/me/notifications/:id/read", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return fail(res, 422, "Invalid notification id.");
    await supabaseAdmin
      .from("customer_notifications")
      .update({ is_read: true })
      .eq("id", id)
      .or(`customer_user_id.eq.${user.id},customer_mobile.eq.${user.mobile}`);
    return okData(res, { id, is_read: true });
  });

  router.post("/me/notifications/read-all", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    await supabaseAdmin
      .from("customer_notifications")
      .update({ is_read: true })
      .or(`customer_user_id.eq.${user.id},customer_mobile.eq.${user.mobile}`);
    return okData(res, { ok: true });
  });

  router.patch("/me/bookings/:bookingId", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const bookingId = Number(req.params.bookingId);
    const cur = await supabaseAdmin
      .from("salon_bookings")
      .select("id,salon_service_id,customer_user_id,customer_mobile")
      .eq("id", bookingId)
      .maybeSingle();
    const row = cur.data as
      | { id: number; salon_service_id: number; customer_user_id: string | null; customer_mobile: string }
      | null;
    if (!row) return fail(res, 404, "Not found.");
    const canEdit = row.customer_user_id === user.id || row.customer_mobile === user.mobile;
    if (!canEdit) return fail(res, 403, "Forbidden.");

    const schema = z
      .object({
        status: z.enum(["cancelled", "completed"]).optional(),
        starts_at: z.string().optional(),
        salon_staff_id: z.number().int().nullable().optional()
      })
      .refine((v) => v.status !== undefined || v.starts_at !== undefined, { message: "Nothing to update." });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const upd: Record<string, unknown> = {};
    if (parsed.data.status) upd.status = parsed.data.status;
    if (parsed.data.starts_at || parsed.data.salon_staff_id !== undefined) {
      const current = await supabaseAdmin
        .from("salon_bookings")
        .select("starts_at,salon_staff_id,salon_service_id")
        .eq("id", bookingId)
        .single();
      const c = current.data as { starts_at: string; salon_staff_id: number; salon_service_id: number };
      const starts = new Date(parsed.data.starts_at ?? c.starts_at);
      const svc = await supabaseAdmin.from("salon_services").select("duration_minutes").eq("id", c.salon_service_id).single();
      const duration = Math.max(1, (svc.data as { duration_minutes: number }).duration_minutes);
      upd.starts_at = starts.toISOString();
      upd.ends_at = new Date(starts.getTime() + duration * 60_000).toISOString();
      if (parsed.data.salon_staff_id !== undefined && parsed.data.salon_staff_id !== null) {
        upd.salon_staff_id = parsed.data.salon_staff_id;
      }
    }
    await supabaseAdmin.from("salon_bookings").update(upd).eq("id", bookingId);
    const out = await bookingToRow(bookingId);
    return okData(res, out);
  });

  router.post("/me/bookings/:bookingId/review", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const bookingId = Number(req.params.bookingId);
    if (!Number.isFinite(bookingId)) return fail(res, 422, "Invalid booking id.");
    const body = z.object({ rating: z.number().int().min(1).max(5), comment: z.string().max(3000).optional().nullable() });
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const bookingRes = await supabaseAdmin
      .from("salon_bookings")
      .select("id,shop_id,salon_staff_id,status,customer_user_id,customer_mobile")
      .eq("id", bookingId)
      .maybeSingle();
    const booking = bookingRes.data as
      | {
          id: number;
          shop_id: number;
          salon_staff_id: number | null;
          status: string;
          customer_user_id: string | null;
          customer_mobile: string;
        }
      | null;
    if (!booking) return fail(res, 404, "Booking not found.");
    const canReview = booking.customer_user_id === user.id || booking.customer_mobile === user.mobile;
    if (!canReview) return fail(res, 403, "Forbidden.");
    if (booking.status !== "completed") return fail(res, 422, "You can review only completed services.");
    if (!booking.salon_staff_id) return fail(res, 422, "Booking has no assigned barber.");

    const existing = await supabaseAdmin
      .from("salon_reviews")
      .select("id")
      .eq("salon_booking_id", booking.id)
      .eq("customer_user_id", user.id)
      .maybeSingle();
    if (existing.data) return fail(res, 409, "You already reviewed this service.");

    const inserted = await supabaseAdmin
      .from("salon_reviews")
      .insert({
        shop_id: booking.shop_id,
        salon_staff_id: booking.salon_staff_id,
        salon_booking_id: booking.id,
        customer_user_id: user.id,
        rating: parsed.data.rating,
        comment: parsed.data.comment?.trim() ? parsed.data.comment.trim() : null
      })
      .select("id,salon_booking_id,rating,comment,created_at")
      .single();
    if (inserted.error || !inserted.data) return fail(res, 500, "Could not save review.");
    return okData(res, inserted.data, 201);
  });

  router.post("/me/bookings/:bookingId/payments", async (req: Request, res: Response) => {
    const user = await authUser(req);
    if (!user) return fail(res, 401, "Unauthenticated.");
    const bookingId = Number(req.params.bookingId);
    if (!Number.isFinite(bookingId)) return fail(res, 422, "Invalid booking id.");

    const parsed = z
      .object({
        method: z.enum(["manual", "bkash"]),
        tip_cents: z.number().int().min(0).max(10_000_000).optional(),
        trx_id: z.string().max(255).optional().nullable(),
        payer_mobile: z.string().max(32).optional().nullable(),
        note: z.string().max(1000).optional().nullable()
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const bookingRes = await supabaseAdmin
      .from("salon_bookings")
      .select("id,shop_id,status,salon_service_id,total_price_cents,customer_user_id,customer_mobile")
      .eq("id", bookingId)
      .maybeSingle();
    const booking = bookingRes.data as
      | {
          id: number;
          shop_id: number;
          status: string;
          salon_service_id: number;
          total_price_cents: number | null;
          customer_user_id: string | null;
          customer_mobile: string;
        }
      | null;
    if (!booking) return fail(res, 404, "Booking not found.");
    const canPay = booking.customer_user_id === user.id || booking.customer_mobile === user.mobile;
    if (!canPay) return fail(res, 403, "Forbidden.");
    if (booking.status !== "completed") return fail(res, 422, "Payment is allowed after service completion.");

    const exists = await supabaseAdmin
      .from("salon_payments")
      .select("id,status")
      .eq("salon_booking_id", booking.id)
      .in("status", ["pending", "completed"])
      .order("id", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (exists.data) return fail(res, 409, "Payment already exists for this booking.");

    let baseAmount = Number(booking.total_price_cents ?? 0);
    if (!baseAmount || baseAmount <= 0) {
      const svc = await supabaseAdmin.from("salon_services").select("price_cents").eq("id", booking.salon_service_id).maybeSingle();
      baseAmount = Number((svc.data as { price_cents: number | null } | null)?.price_cents ?? 0);
    }
    if (baseAmount <= 0) return fail(res, 422, "Booking amount is not available.");

    const tipCents = Number(parsed.data.tip_cents ?? 0);
    const totalCents = baseAmount + tipCents;

    const paymentIns = await supabaseAdmin
      .from("salon_payments")
      .insert({
        shop_id: booking.shop_id,
        salon_booking_id: booking.id,
        method: parsed.data.method,
        amount_cents: totalCents,
        currency: "BDT",
        transaction_id: parsed.data.trx_id ?? null,
        status: "completed",
        metadata: {
          source: "customer_portal",
          base_amount_cents: baseAmount,
          tip_cents: tipCents,
          note: parsed.data.note ?? null
        }
      })
      .select("*")
      .single();
    if (paymentIns.error || !paymentIns.data) return fail(res, 500, "Could not save payment.");

    if (parsed.data.method === "bkash") {
      await supabaseAdmin.from("bkash_payments").insert({
        shop_id: booking.shop_id,
        amount_paisa: totalCents,
        trx_id: parsed.data.trx_id ?? null,
        status: "completed",
        payer_mobile: parsed.data.payer_mobile ?? user.mobile,
        note: parsed.data.note ?? null
      });
    }

    return okData(res, paymentIns.data, 201);
  });
}
