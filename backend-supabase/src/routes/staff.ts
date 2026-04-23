import type { Request, Response, Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { fail, okData } from "../lib/http.js";
import { bookingToRow } from "../presenters/booking.js";
import { notifyCustomerBookingEvent, notifyCustomerBookingStatusChange } from "../lib/customer-notifications.js";

async function staffFromContext(req: Request): Promise<{ id: number; shop_id: number; name: string } | null> {
  const s = req.salon;
  if (!s) return null;
  if (s.staffScopeId == null) return null;
  const row = await supabaseAdmin
    .from("salon_staff")
    .select("id,shop_id,name")
    .eq("id", s.staffScopeId)
    .eq("shop_id", s.shop.id)
    .eq("is_active", true)
    .maybeSingle();
  return (row.data as { id: number; shop_id: number; name: string } | null) ?? null;
}

async function staffBookingRows(staffId: number, query?: { from?: string; to?: string; status?: string }) {
  let q = supabaseAdmin
    .from("salon_bookings")
    .select("id")
    .eq("salon_staff_id", staffId)
    .order("starts_at", { ascending: true })
    .limit(500);
  if (query?.from) q = q.gte("starts_at", query.from);
  if (query?.to) q = q.lte("starts_at", query.to);
  if (query?.status) q = q.eq("status", query.status);
  const rows = await q;
  const data = [];
  for (const row of (rows.data ?? []) as { id: number }[]) {
    const b = await bookingToRow(row.id);
    if (b) data.push(b);
  }
  return data;
}

async function customerRiskProfileByMobile(shopId: number, mobile: string) {
  const rows = await supabaseAdmin
    .from("salon_bookings")
    .select("customer_name,status,starts_at")
    .eq("shop_id", shopId)
    .eq("customer_mobile", mobile)
    .order("starts_at", { ascending: false })
    .limit(2000);
  const list = (rows.data ?? []) as { customer_name: string; status: string; starts_at: string }[];
  let completed = 0;
  let cancelled = 0;
  let noShow = 0;
  let pending = 0;
  let confirmed = 0;
  for (const b of list) {
    const s = String(b.status ?? "").toLowerCase();
    if (s === "completed") completed += 1;
    else if (s === "cancelled") cancelled += 1;
    else if (s === "no_show") noShow += 1;
    else if (s === "pending") pending += 1;
    else if (s === "confirmed") confirmed += 1;
  }
  const total = list.length;
  const negatives = cancelled + noShow;
  const cancellationRatePercent = total > 0 ? Math.round((negatives / total) * 1000) / 10 : 0;
  const riskLevel = cancellationRatePercent >= 50 ? "high" : cancellationRatePercent >= 25 ? "medium" : "low";
  return {
    customer_name: list[0]?.customer_name ?? "Customer",
    customer_mobile: mobile,
    total_bookings: total,
    completed,
    confirmed,
    pending,
    cancelled,
    no_show: noShow,
    cancellation_rate_percent: cancellationRatePercent,
    risk_level: riskLevel,
    last_visit_at: list[0]?.starts_at ?? null
  };
}

export function mountStaffRoutes(router: Router): void {
  router.get("/my/barber/today", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
    const data = await staffBookingRows(staff.id, { from: start, to: end });
    return okData(res, data);
  });

  router.get("/my/barber/history", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const now = new Date().toISOString();
    const data = await staffBookingRows(staff.id, { to: now });
    return okData(res, data);
  });

  router.get("/staff/dashboard", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();
    const today = await staffBookingRows(staff.id, { from: start, to: end });
    const next = today.find((b) => String((b as Record<string, unknown>).starts_at) >= now.toISOString()) ?? null;
    const sp = await supabaseAdmin
      .from("salon_staff")
      .select("photo_url,availability_status,commission_percent,shop_id")
      .eq("id", staff.id)
      .single();
    const shop = await supabaseAdmin.from("shops").select("id,name,slug,is_active").eq("id", staff.shop_id).single();
    const revenueRows = await supabaseAdmin
      .from("salon_bookings")
      .select("salon_service_id,status")
      .eq("salon_staff_id", staff.id)
      .gte("starts_at", start)
      .lte("starts_at", end);
    const serviceIds = [...new Set((revenueRows.data ?? []).map((x: { salon_service_id: number }) => x.salon_service_id))];
    const svc = serviceIds.length
      ? await supabaseAdmin.from("salon_services").select("id,price_cents").in("id", serviceIds)
      : { data: [] };
    const priceMap = new Map<number, number>();
    for (const row of (svc.data ?? []) as { id: number; price_cents: number | null }[]) {
      priceMap.set(row.id, Number(row.price_cents ?? 0));
    }
    let todayRevenue = 0;
    for (const row of (revenueRows.data ?? []) as { salon_service_id: number; status: string }[]) {
      if (row.status === "completed" || row.status === "confirmed" || row.status === "pending") {
        todayRevenue += priceMap.get(row.salon_service_id) ?? 0;
      }
    }
    const commissionPct = Number((sp.data as { commission_percent: number | null }).commission_percent ?? 0);
    return okData(res, {
      staff: {
        id: staff.id,
        name: staff.name,
        photo_url: (sp.data as { photo_url: string | null }).photo_url ?? null,
        availability_status: (sp.data as { availability_status: string }).availability_status ?? "available",
        commission_percent: commissionPct || null
      },
      shop: shop.data ?? null,
      today_appointment_count: today.length,
      today_commission_cents_estimate: Math.round((todayRevenue * commissionPct) / 100),
      next_appointment: next
        ? {
            id: (next as Record<string, unknown>).id,
            customer_name: (next as Record<string, unknown>).customer_name,
            starts_at: (next as Record<string, unknown>).starts_at,
            service: { name: ((next as Record<string, unknown>).service as Record<string, unknown>)?.name as string | undefined }
          }
        : null
    });
  });

  router.get("/staff/appointments", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const data = await staffBookingRows(staff.id, {
      from: typeof req.query.from === "string" ? req.query.from : undefined,
      to: typeof req.query.to === "string" ? req.query.to : undefined,
      status: typeof req.query.status === "string" ? req.query.status : undefined
    });
    return okData(res, data);
  });

  router.get("/staff/customers/:mobile/profile", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const mobile = decodeURIComponent(req.params.mobile);
    if (!mobile) return fail(res, 422, "Invalid mobile.");
    const profile = await customerRiskProfileByMobile(staff.shop_id, mobile);
    return okData(res, profile);
  });

  router.patch("/staff/appointments/:bookingId", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const bookingId = Number(req.params.bookingId);
    const row = await supabaseAdmin
      .from("salon_bookings")
      .select("id,salon_staff_id,status")
      .eq("id", bookingId)
      .eq("salon_staff_id", staff.id)
      .maybeSingle();
    if (!row.data) return fail(res, 404, "Not found.");
    const schema = z.object({ status: z.string(), notes: z.string().nullable().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    await supabaseAdmin
      .from("salon_bookings")
      .update({ status: parsed.data.status, ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}) })
      .eq("id", bookingId);
    const prevStatus = (row.data as { status: string }).status;
    if (parsed.data.status !== prevStatus && parsed.data.status !== "confirmed" && parsed.data.status !== "completed") {
      await notifyCustomerBookingStatusChange({
        bookingId,
        fromStatus: prevStatus,
        toStatus: parsed.data.status
      });
    }
    if (parsed.data.status === "confirmed" && prevStatus !== "confirmed") {
      await notifyCustomerBookingEvent({ bookingId, type: "booking_confirmed" });
    }
    if (parsed.data.status === "completed" && prevStatus !== "completed") {
      await notifyCustomerBookingEvent({ bookingId, type: "service_completed_review" });
    }
    const out = await bookingToRow(bookingId);
    return okData(res, out);
  });

  router.post("/staff/appointments/:bookingId/reschedule-request", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const bookingId = Number(req.params.bookingId);
    const schema = z.object({ message: z.string().min(1), suggested_starts_at: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const b = await supabaseAdmin
      .from("salon_bookings")
      .select("id,salon_staff_id,notes")
      .eq("id", bookingId)
      .eq("salon_staff_id", staff.id)
      .maybeSingle();
    if (!b.data) return fail(res, 404, "Not found.");
    const notes = [
      (b.data as { notes: string | null }).notes,
      `Reschedule request: ${parsed.data.message}`,
      parsed.data.suggested_starts_at ? `Suggested: ${parsed.data.suggested_starts_at}` : null
    ]
      .filter(Boolean)
      .join("\n");
    await supabaseAdmin.from("salon_bookings").update({ notes }).eq("id", bookingId);
    const out = await bookingToRow(bookingId);
    return okData(res, out);
  });

  router.get("/staff/schedule", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const sp = await supabaseAdmin
      .from("salon_staff")
      .select("weekly_schedule")
      .eq("id", staff.id)
      .single();
    const shop = await supabaseAdmin.from("shops").select("settings").eq("id", staff.shop_id).single();
    const leave = await supabaseAdmin
      .from("staff_leave_requests")
      .select("id,date,reason,status,manager_note")
      .eq("salon_staff_id", staff.id)
      .order("date", { ascending: false })
      .limit(200);
    const blocks = await supabaseAdmin
      .from("salon_blocked_slots")
      .select("id,starts_at,ends_at,kind,note")
      .eq("salon_staff_id", staff.id)
      .order("starts_at", { ascending: false })
      .limit(200);
    const settings = (shop.data as { settings: Record<string, unknown> | null } | null)?.settings ?? {};
    return okData(res, {
      weekly_schedule: (sp.data as { weekly_schedule: unknown } | null)?.weekly_schedule ?? {},
      shop_business_hours: (settings as Record<string, unknown>).business_hours ?? {},
      shop_holidays: (settings as Record<string, unknown>).holidays ?? [],
      leave_requests: leave.data ?? [],
      availability_blocks: (blocks.data ?? []).map((b: { id: number; starts_at: string; ends_at: string; kind: string; note: string | null }) => ({
        ...b
      }))
    });
  });

  router.get("/staff/leave-requests", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const rows = await supabaseAdmin
      .from("staff_leave_requests")
      .select("id,date,reason,status,manager_note")
      .eq("salon_staff_id", staff.id)
      .order("date", { ascending: false })
      .limit(200);
    return okData(res, rows.data ?? []);
  });

  router.post("/staff/leave-requests", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const schema = z.object({ date: z.string(), reason: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const row = await supabaseAdmin
      .from("staff_leave_requests")
      .insert({
        salon_staff_id: staff.id,
        date: parsed.data.date,
        reason: parsed.data.reason,
        status: "pending"
      })
      .select("id,date,reason,status")
      .single();
    if (row.error || !row.data) return fail(res, 500, "Could not create leave request.");
    return okData(res, row.data, 201);
  });

  router.get("/staff/customers", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const rows = await supabaseAdmin
      .from("salon_bookings")
      .select("customer_mobile,customer_name,starts_at")
      .eq("salon_staff_id", staff.id)
      .order("starts_at", { ascending: false })
      .limit(2000);
    const byMobile = new Map<string, { customer_mobile: string; customer_name: string; visit_count: number; last_visit_at: string }>();
    for (const row of (rows.data ?? []) as { customer_mobile: string; customer_name: string; starts_at: string }[]) {
      const ex = byMobile.get(row.customer_mobile);
      if (!ex) byMobile.set(row.customer_mobile, { customer_mobile: row.customer_mobile, customer_name: row.customer_name, visit_count: 1, last_visit_at: row.starts_at });
      else {
        ex.visit_count += 1;
        if (row.starts_at > ex.last_visit_at) ex.last_visit_at = row.starts_at;
      }
    }
    return okData(res, [...byMobile.values()]);
  });

  router.get("/staff/customers/:mobile/history", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const mobile = decodeURIComponent(req.params.mobile);
    const rows = await supabaseAdmin
      .from("salon_bookings")
      .select("id")
      .eq("salon_staff_id", staff.id)
      .eq("customer_mobile", mobile)
      .order("starts_at", { ascending: false })
      .limit(200);
    const data = [];
    for (const row of (rows.data ?? []) as { id: number }[]) {
      const b = await bookingToRow(row.id);
      if (b) data.push(b);
    }
    return okData(res, data);
  });

  router.get("/staff/customers/:mobile/notes", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const mobile = decodeURIComponent(req.params.mobile);
    const rows = await supabaseAdmin
      .from("staff_customer_notes")
      .select("id,note,created_at")
      .eq("salon_staff_id", staff.id)
      .eq("customer_mobile", mobile)
      .order("id", { ascending: false })
      .limit(200);
    return okData(res, rows.data ?? []);
  });

  router.post("/staff/customer-notes", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const schema = z.object({ customer_mobile: z.string().min(3), note: z.string().min(1) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const row = await supabaseAdmin
      .from("staff_customer_notes")
      .insert({
        salon_staff_id: staff.id,
        customer_mobile: parsed.data.customer_mobile,
        note: parsed.data.note
      })
      .select("id,note,created_at")
      .single();
    if (row.error || !row.data) return fail(res, 500, "Could not create note.");
    return okData(res, row.data, 201);
  });

  router.get("/staff/services", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const mapRows = await supabaseAdmin.from("salon_staff_services").select("service_id").eq("staff_id", staff.id);
    const ids = (mapRows.data ?? []).map((x: { service_id: number }) => x.service_id);
    if (!ids.length) return okData(res, []);
    const rows = await supabaseAdmin
      .from("salon_services")
      .select("id,name,category,description,duration_minutes,price_cents")
      .in("id", ids);
    return okData(res, rows.data ?? []);
  });

  router.get("/staff/earnings/summary", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const from = typeof req.query.from === "string" ? new Date(req.query.from) : new Date(Date.now() - 30 * 86400_000);
    const to = typeof req.query.to === "string" ? new Date(req.query.to) : new Date();
    const rows = await supabaseAdmin
      .from("salon_bookings")
      .select("id,starts_at,customer_name,status,salon_service_id")
      .eq("salon_staff_id", staff.id)
      .gte("starts_at", from.toISOString())
      .lte("starts_at", to.toISOString())
      .limit(2000);
    const svcIds = [...new Set((rows.data ?? []).map((x: { salon_service_id: number }) => x.salon_service_id))];
    const svcRows = svcIds.length
      ? await supabaseAdmin.from("salon_services").select("id,name,price_cents").in("id", svcIds)
      : { data: [] };
    const svcMap = new Map<number, { name: string; price_cents: number }>();
    for (const s of (svcRows.data ?? []) as { id: number; name: string; price_cents: number | null }[]) {
      svcMap.set(s.id, { name: s.name, price_cents: Number(s.price_cents ?? 0) });
    }
    const staffInfo = await supabaseAdmin.from("salon_staff").select("commission_percent").eq("id", staff.id).single();
    const pct = Number((staffInfo.data as { commission_percent: number | null }).commission_percent ?? 0);
    let total = 0;
    const breakdown = [];
    for (const b of (rows.data ?? []) as { id: number; starts_at: string; customer_name: string; status: string; salon_service_id: number }[]) {
      const svc = svcMap.get(b.salon_service_id) ?? { name: "", price_cents: 0 };
      const commission = Math.round((svc.price_cents * pct) / 100);
      if (b.status === "completed") total += commission;
      breakdown.push({
        booking_id: b.id,
        starts_at: b.starts_at,
        customer_name: b.customer_name,
        service_name: svc.name,
        price_cents: svc.price_cents,
        commission_cents: commission,
        commission_status: b.status === "completed" ? "earned" : "pending"
      });
    }
    return okData(res, {
      commission_percent: pct || null,
      range: { from: from.toISOString(), to: to.toISOString(), total_commission_cents: total },
      this_week_commission_cents_estimate: total,
      this_month_commission_cents_estimate: total,
      breakdown
    });
  });

  router.get("/staff/notifications", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const rows = await supabaseAdmin
      .from("staff_notifications")
      .select("id,type,title,body,metadata,is_read,created_at")
      .eq("salon_staff_id", staff.id)
      .order("id", { ascending: false })
      .limit(200);
    return okData(res, rows.data ?? []);
  });

  router.patch("/staff/notifications/:notification/read", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    await supabaseAdmin
      .from("staff_notifications")
      .update({ is_read: true })
      .eq("id", Number(req.params.notification))
      .eq("salon_staff_id", staff.id);
    return res.json({ message: "Updated." });
  });

  router.post("/staff/notifications/read-all", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    await supabaseAdmin.from("staff_notifications").update({ is_read: true }).eq("salon_staff_id", staff.id);
    return res.json({ message: "Updated." });
  });

  router.delete("/staff/notifications", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    await supabaseAdmin.from("staff_notifications").delete().eq("salon_staff_id", staff.id);
    return res.json({ message: "Deleted." });
  });

  router.patch("/staff/notification-preferences", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const schema = z.object({ email_alerts: z.boolean().optional(), sms_alerts: z.boolean().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const row = await supabaseAdmin.from("salon_staff").select("portal_settings").eq("id", staff.id).single();
    const existing = ((row.data as { portal_settings: Record<string, unknown> | null }).portal_settings ?? {}) as Record<string, unknown>;
    const merged = {
      ...existing,
      notification_preferences: {
        ...((existing.notification_preferences as Record<string, unknown> | undefined) ?? {}),
        ...parsed.data
      }
    };
    await supabaseAdmin.from("salon_staff").update({ portal_settings: merged }).eq("id", staff.id);
    return okData(res, merged.notification_preferences as Record<string, unknown>);
  });

  router.get("/staff/availability", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const row = await supabaseAdmin.from("salon_staff").select("availability_status").eq("id", staff.id).single();
    return okData(res, { availability_status: (row.data as { availability_status: string }).availability_status ?? "available" });
  });

  router.patch("/staff/availability", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const schema = z.object({ availability_status: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    await supabaseAdmin.from("salon_staff").update({ availability_status: parsed.data.availability_status }).eq("id", staff.id);
    return okData(res, { availability_status: parsed.data.availability_status });
  });

  router.get("/staff/availability/blocks", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    let q = supabaseAdmin
      .from("salon_blocked_slots")
      .select("id,starts_at,ends_at,kind,note")
      .eq("salon_staff_id", staff.id)
      .order("starts_at", { ascending: false })
      .limit(300);
    if (typeof req.query.from === "string") q = q.gte("starts_at", req.query.from);
    if (typeof req.query.to === "string") q = q.lte("starts_at", req.query.to);
    const rows = await q;
    const data = (rows.data ?? []).map((r: { id: number; starts_at: string; ends_at: string; kind: string; note: string | null }) => ({
      id: r.id,
      starts_at: r.starts_at,
      ends_at: r.ends_at,
      kind: r.kind,
      note: r.note
    }));
    return okData(res, data);
  });

  router.post("/staff/availability/blocks", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const schema = z.object({ starts_at: z.string(), ends_at: z.string(), note: z.string().nullable().optional(), kind: z.string().optional() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const row = await supabaseAdmin
      .from("salon_blocked_slots")
      .insert({
        shop_id: staff.shop_id,
        salon_staff_id: staff.id,
        starts_at: parsed.data.starts_at,
        ends_at: parsed.data.ends_at,
        kind: parsed.data.kind ?? "other",
        reason: parsed.data.note ?? null,
        note: parsed.data.note ?? null
      })
      .select("id,starts_at,ends_at")
      .single();
    if (row.error || !row.data) return fail(res, 500, "Could not create block.");
    return okData(res, row.data, 201);
  });

  router.delete("/staff/availability/blocks/:block", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    await supabaseAdmin
      .from("salon_blocked_slots")
      .delete()
      .eq("id", Number(req.params.block))
      .eq("salon_staff_id", staff.id);
    return res.json({ message: "Deleted." });
  });

  router.get("/staff/reviews", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    let q = supabaseAdmin
      .from("salon_reviews")
      .select("id,rating,comment,created_at")
      .eq("salon_staff_id", staff.id)
      .order("created_at", { ascending: false })
      .limit(300);
    if (typeof req.query.rating === "string") q = q.eq("rating", Number(req.query.rating));
    const rows = await q;
    const list = rows.data ?? [];
    const count = list.length;
    const avg = count ? list.reduce((a: number, b: { rating: number }) => a + Number(b.rating), 0) / count : null;
    return okData(res, { average_rating: avg, count, reviews: list });
  });

  router.get("/staff/profile", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const row = await supabaseAdmin.from("salon_staff").select("*").eq("id", staff.id).single();
    const shop = await supabaseAdmin.from("shops").select("id,name,slug,is_active").eq("id", staff.shop_id).single();
    const s = row.data as Record<string, unknown>;
    return okData(res, {
      id: s.id,
      shop_id: s.shop_id,
      name: s.name,
      bio: s.bio ?? null,
      photo_url: s.photo_url ?? null,
      work_mobile: s.work_mobile ?? null,
      email: s.email ?? null,
      specialties: Array.isArray(s.specialties) ? s.specialties : [],
      shop: shop.data ?? null,
      commission_percent: s.commission_percent ?? null,
      availability_status: s.availability_status ?? "available",
      portal_settings: s.portal_settings ?? {}
    });
  });

  router.patch("/staff/profile", async (req: Request, res: Response) => {
    const staff = await staffFromContext(req);
    if (!staff) return fail(res, 403, "No staff profile for this shop.");
    const actor = req.salon?.user;
    if (!actor || actor.role !== "barber") {
      return fail(res, 403, "Staff profile is view-only for manager/owner accounts.");
    }
    const body = req.body as Record<string, unknown>;
    const allowed = ["name", "bio", "photo_url", "work_mobile", "email", "specialties", "portal_settings"];
    const upd: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in body) upd[k] = body[k];
    }
    await supabaseAdmin.from("salon_staff").update(upd).eq("id", staff.id);
    const row = await supabaseAdmin.from("salon_staff").select("*").eq("id", staff.id).single();
    const s = row.data as Record<string, unknown>;
    const shop = await supabaseAdmin.from("shops").select("id,name,slug,is_active").eq("id", staff.shop_id).single();
    return okData(res, {
      id: s.id,
      shop_id: s.shop_id,
      name: s.name,
      bio: s.bio ?? null,
      photo_url: s.photo_url ?? null,
      work_mobile: s.work_mobile ?? null,
      email: s.email ?? null,
      specialties: Array.isArray(s.specialties) ? s.specialties : [],
      shop: shop.data ?? null,
      commission_percent: s.commission_percent ?? null,
      availability_status: s.availability_status ?? "available",
      portal_settings: s.portal_settings ?? {}
    });
  });
}
