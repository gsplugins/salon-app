import type { Request, Response, Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../lib/supabase.js";
import { fail, okData } from "../lib/http.js";
import { normalizeMobile } from "../lib/mobile.js";
import { bookingToRow } from "../presenters/booking.js";
import {
  notifyCustomerBookingEvent,
  notifyCustomerBookingStatusChange,
  notifyCustomerReviewReply,
  notifyCustomerStatusChange
} from "../lib/customer-notifications.js";
import type { ShopRow } from "../salon-types.js";
import { shopMemberRole } from "../lib/shop-resolution.js";

function deepMergeSettings(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v) && out[k] && typeof out[k] === "object" && !Array.isArray(out[k])) {
      out[k] = deepMergeSettings(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function shopPayload(shop: ShopRow, user: { id: string; role: string }, memberRole: "owner" | "manager" | "barber" | null): Record<string, unknown> {
  const isBarber = user.role === "barber";
  const canEditShopBasics = !isBarber;
  const canEditBusinessHours =
    user.role === "super_admin" || user.role === "shop_owner" || memberRole === "owner" || memberRole === "manager";
  return {
    id: shop.id,
    name: shop.name,
    slug: shop.slug,
    description: shop.description,
    phone: shop.phone,
    email: shop.email,
    address: shop.address,
    latitude: shop.latitude ?? null,
    longitude: shop.longitude ?? null,
    is_active: shop.is_active,
    settings: shop.settings ?? {},
    subscription: null,
    permissions: {
      can_edit_shop_basics: canEditShopBasics,
      can_edit_business_hours: canEditBusinessHours,
      can_edit_booking_rules: canEditBusinessHours,
      can_edit_currency: user.role === "super_admin" || memberRole === "owner" || user.role === "shop_owner",
      can_manage_payments: !isBarber,
      can_view_subscription: !isBarber
    }
  };
}

async function attachSubscription(shopId: number, payload: Record<string, unknown>): Promise<void> {
  const sub = await supabaseAdmin.from("subscriptions").select("*").eq("shop_id", shopId).maybeSingle();
  if (!sub.data) return;
  const s = sub.data as {
    status: string;
    plan_key: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
  };
  payload.subscription = {
    status: s.status,
    plan_key: s.plan_key,
    plan_name: null,
    trial_ends_at: s.trial_ends_at,
    current_period_end: s.current_period_end,
    features: {}
  };
}

async function customerRiskProfileByMobile(shopId: number, mobile: string) {
  const rows = await supabaseAdmin
    .from("salon_bookings")
    .select("customer_name,status,starts_at")
    .eq("shop_id", shopId)
    .eq("customer_mobile", mobile)
    .order("starts_at", { ascending: false })
    .limit(5000);
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

async function canManageCustomers(user: { id: string; role: string }, shopId: number): Promise<boolean> {
  if (user.role === "super_admin") return true;
  const role = await shopMemberRole(user.id, shopId);
  return role === "owner" || role === "manager" || user.role === "shop_owner";
}

async function staffCatalogRow(staffId: number): Promise<Record<string, unknown> | null> {
  const st = await supabaseAdmin.from("salon_staff").select("*").eq("id", staffId).maybeSingle();
  if (!st.data) return null;
  const s = st.data as Record<string, unknown>;
  const maps = await supabaseAdmin.from("salon_staff_services").select("service_id").eq("staff_id", staffId);
  const svcIds = (maps.data ?? []).map((x: { service_id: number }) => x.service_id);
  let services: { id: number; name: string }[] = [];
  if (svcIds.length) {
    const sv = await supabaseAdmin.from("salon_services").select("id,name").in("id", svcIds);
    services = (sv.data ?? []) as { id: number; name: string }[];
  }
  const uid = s.user_id as string | null;
  let login_mobile: string | null = null;
  if (uid) {
    const u = await supabaseAdmin.from("users").select("mobile").eq("id", uid).maybeSingle();
    login_mobile = (u.data as { mobile: string } | null)?.mobile ?? null;
  }
  return {
    id: s.id,
    user_id: s.user_id ?? null,
    has_staff_login: Boolean(s.user_id),
    name: s.name,
    position_title: s.position_title ?? null,
    staff_role: s.staff_role ?? null,
    bio: s.bio ?? null,
    specialties: Array.isArray(s.specialties) ? s.specialties : [],
    address: s.address ?? null,
    age: s.age ?? null,
    experience_years: s.experience_years ?? null,
    work_mobile: s.work_mobile ?? null,
    emergency_contact_name: s.emergency_contact_name ?? null,
    emergency_contact_phone: s.emergency_contact_phone ?? null,
    login_mobile,
    is_active: s.is_active,
    sort_order: s.sort_order,
    services
  };
}

export function mountMyShopRoutes(router: Router): void {
  const r = router;

  r.get("/my/shop/profile", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    const memberRole = await shopMemberRole(user.id, shop.id);
    const payload = shopPayload(shop, user, memberRole);
    await attachSubscription(shop.id, payload);
    return okData(res, payload);
  });

  r.patch("/my/shop/profile", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    if (user.role === "barber") {
      return res.status(403).json({ message: "Salon staff cannot edit shop-wide settings. Ask a manager or owner." });
    }
    const body = req.body as Record<string, unknown>;
    const updates: Record<string, unknown> = {};
    if (typeof body.name === "string") updates.name = body.name;
    if ("description" in body) updates.description = body.description === null ? null : String(body.description);
    if ("phone" in body) updates.phone = body.phone === null ? null : String(body.phone);
    if ("email" in body) {
      const mrole = await shopMemberRole(user.id, shop.id);
      if (mrole !== "manager") updates.email = body.email === null ? null : String(body.email);
    }
    if ("address" in body) updates.address = body.address === null ? null : String(body.address);
    if ("latitude" in body) updates.latitude = body.latitude === null ? null : String(body.latitude);
    if ("longitude" in body) updates.longitude = body.longitude === null ? null : String(body.longitude);
    if (body.settings && typeof body.settings === "object" && body.settings !== null) {
      const cur = (shop.settings ?? {}) as Record<string, unknown>;
      updates.settings = deepMergeSettings(cur, body.settings as Record<string, unknown>);
    }
    const saved = await supabaseAdmin.from("shops").update(updates).eq("id", shop.id).select("*").single();
    if (saved.error || !saved.data) return fail(res, 500, "Could not update shop.");
    const fresh = saved.data as ShopRow;
    const memberRole = await shopMemberRole(user.id, fresh.id);
    const payload = shopPayload(fresh, user, memberRole);
    await attachSubscription(fresh.id, payload);
    return okData(res, payload);
  });

  r.get("/my/shop/stats", async (req: Request, res: Response) => {
    const { shop, staffScopeId } = req.salon!;
    const shopId = shop.id;
    const now = new Date();
    const startDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const endDay = new Date(startDay.getTime() + 86400_000);
    const weekStart = new Date(startDay);
    weekStart.setUTCDate(weekStart.getUTCDate() - weekStart.getUTCDay());
    const weekEnd = new Date(weekStart.getTime() + 7 * 86400_000);

    let qToday = supabaseAdmin.from("salon_bookings").select("id", { count: "exact", head: true }).eq("shop_id", shopId).gte("starts_at", startDay.toISOString()).lt("starts_at", endDay.toISOString());
    let qWeek = supabaseAdmin.from("salon_bookings").select("id", { count: "exact", head: true }).eq("shop_id", shopId).gte("starts_at", weekStart.toISOString()).lt("starts_at", weekEnd.toISOString());
    if (staffScopeId != null) {
      qToday = qToday.eq("salon_staff_id", staffScopeId);
      qWeek = qWeek.eq("salon_staff_id", staffScopeId);
    }
    const [todayC, weekC] = await Promise.all([qToday, qWeek]);
    const completedQ = supabaseAdmin
      .from("salon_bookings")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "completed")
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at", weekEnd.toISOString());
    const pendingQ = supabaseAdmin
      .from("salon_bookings")
      .select("id", { count: "exact", head: true })
      .eq("shop_id", shopId)
      .eq("status", "pending")
      .gte("starts_at", now.toISOString());
    let cq = completedQ;
    let pq = pendingQ;
    if (staffScopeId != null) {
      cq = cq.eq("salon_staff_id", staffScopeId);
      pq = pq.eq("salon_staff_id", staffScopeId);
    }
    const [compC, pendC] = await Promise.all([cq, pq]);

    let completedList = supabaseAdmin
      .from("salon_bookings")
      .select("salon_service_id")
      .eq("shop_id", shopId)
      .eq("status", "completed")
      .gte("starts_at", weekStart.toISOString())
      .lt("starts_at", weekEnd.toISOString());
    if (staffScopeId != null) completedList = completedList.eq("salon_staff_id", staffScopeId);
    const compRows = await completedList;
    const svcIds = [...new Set((compRows.data ?? []).map((x: { salon_service_id: number }) => x.salon_service_id))];
    const priceMap = new Map<number, number>();
    if (svcIds.length) {
      const svcRows = await supabaseAdmin.from("salon_services").select("id,price_cents").in("id", svcIds);
      for (const s of (svcRows.data ?? []) as { id: number; price_cents: number | null }[]) {
        priceMap.set(s.id, Number(s.price_cents ?? 0));
      }
    }
    let revenue = 0;
    for (const row of (compRows.data ?? []) as { salon_service_id: number }[]) {
      revenue += priceMap.get(row.salon_service_id) ?? 0;
    }

    return okData(res, {
      bookings_today: todayC.count ?? 0,
      bookings_this_week: weekC.count ?? 0,
      completed_this_week: compC.count ?? 0,
      pending_upcoming: pendC.count ?? 0,
      estimated_revenue_cents_this_week: revenue
    });
  });

  r.get("/my/shop/clients", async (req: Request, res: Response) => {
    const { shop, staffScopeId } = req.salon!;
    let q = supabaseAdmin
      .from("salon_bookings")
      .select("customer_mobile,customer_name,starts_at,salon_service_id")
      .eq("shop_id", shop.id)
      .order("starts_at", { ascending: false })
      .limit(2000);
    if (staffScopeId != null) q = q.eq("salon_staff_id", staffScopeId);
    const rows = await q;
    const byMobile = new Map<
      string,
      {
        customer_mobile: string;
        customer_name: string;
        visit_count: number;
        last_visit_at: string;
        last_service_id: number | null;
      }
    >();
    for (const row of (rows.data ?? []) as { customer_mobile: string; customer_name: string; starts_at: string; salon_service_id: number | null }[]) {
      const ex = byMobile.get(row.customer_mobile);
      if (!ex) {
        byMobile.set(row.customer_mobile, {
          customer_mobile: row.customer_mobile,
          customer_name: row.customer_name,
          visit_count: 1,
          last_visit_at: row.starts_at,
          last_service_id: row.salon_service_id ?? null
        });
      } else {
        ex.visit_count += 1;
        if (row.starts_at > ex.last_visit_at) {
          ex.last_visit_at = row.starts_at;
          ex.last_service_id = row.salon_service_id ?? null;
        }
      }
    }

    const serviceIds = [...new Set([...byMobile.values()].map((x) => x.last_service_id).filter((x): x is number => x != null))];
    const serviceMap = new Map<number, string>();
    if (serviceIds.length) {
      const sv = await supabaseAdmin.from("salon_services").select("id,name").in("id", serviceIds);
      for (const row of (sv.data ?? []) as { id: number; name: string }[]) {
        serviceMap.set(row.id, row.name);
      }
    }

    const mobiles = [...byMobile.keys()];
    const ctrlMap = new Map<string, { is_suspended: boolean; is_removed: boolean }>();
    if (mobiles.length) {
      const controls = await supabaseAdmin
        .from("shop_customer_controls")
        .select("customer_mobile,is_suspended,is_removed")
        .eq("shop_id", shop.id)
        .in("customer_mobile", mobiles);
      for (const c of (controls.data ?? []) as { customer_mobile: string; is_suspended: boolean; is_removed: boolean }[]) {
        ctrlMap.set(c.customer_mobile, { is_suspended: Boolean(c.is_suspended), is_removed: Boolean(c.is_removed) });
      }
    }

    const includeRemoved = String(req.query.include_removed ?? "") === "1";
    const out = [...byMobile.values()]
      .map((row) => {
        const ctrl = ctrlMap.get(row.customer_mobile) ?? { is_suspended: false, is_removed: false };
        return {
          customer_mobile: row.customer_mobile,
          customer_name: row.customer_name,
          visit_count: row.visit_count,
          last_visit_at: row.last_visit_at,
          last_service_name: row.last_service_id != null ? serviceMap.get(row.last_service_id) ?? null : null,
          is_suspended: ctrl.is_suspended,
          is_removed: ctrl.is_removed
        };
      })
      .filter((row) => includeRemoved || !row.is_removed)
      .sort((a, b) => (a.last_visit_at < b.last_visit_at ? 1 : -1))
      .slice(0, 200);
    return okData(res, out);
  });

  r.get("/my/shop/customers/:mobile/profile", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const mobile = decodeURIComponent(req.params.mobile);
    if (!mobile) return fail(res, 422, "Invalid mobile.");
    const profile = await customerRiskProfileByMobile(shop.id, mobile);
    return okData(res, profile);
  });

  r.get("/my/shop/customers/:mobile/details", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const mobile = decodeURIComponent(req.params.mobile);
    if (!mobile) return fail(res, 422, "Invalid mobile.");

    const controls = await supabaseAdmin
      .from("shop_customer_controls")
      .select("is_suspended,is_removed,note,updated_at")
      .eq("shop_id", shop.id)
      .eq("customer_mobile", mobile)
      .maybeSingle();
    const status = (controls.data as { is_suspended: boolean; is_removed: boolean; note: string | null; updated_at: string } | null) ?? null;

    const userRow = await supabaseAdmin
      .from("users")
      .select("id,name,mobile,is_locked,created_at")
      .eq("mobile", mobile)
      .maybeSingle();

    const shopBookings = await supabaseAdmin
      .from("salon_bookings")
      .select("id,shop_id,customer_name,starts_at,status,salon_service_id")
      .eq("customer_mobile", mobile)
      .order("starts_at", { ascending: false })
      .limit(500);
    const bookingRows = (shopBookings.data ?? []) as {
      id: number;
      shop_id: number;
      customer_name: string;
      starts_at: string;
      status: string;
      salon_service_id: number | null;
    }[];
    const shopIds = [...new Set(bookingRows.map((x) => x.shop_id))];
    const svcIds = [...new Set(bookingRows.map((x) => x.salon_service_id).filter((x): x is number => x != null))];

    const shopMap = new Map<number, { id: number; name: string; slug: string }>();
    if (shopIds.length) {
      const shops = await supabaseAdmin.from("shops").select("id,name,slug").in("id", shopIds);
      for (const s of (shops.data ?? []) as { id: number; name: string; slug: string }[]) {
        shopMap.set(s.id, s);
      }
    }
    const svcMap = new Map<number, { name: string; duration_minutes: number; price_cents: number | null }>();
    if (svcIds.length) {
      const sv = await supabaseAdmin.from("salon_services").select("id,name,duration_minutes,price_cents").in("id", svcIds);
      for (const s of (sv.data ?? []) as { id: number; name: string; duration_minutes: number; price_cents: number | null }[]) {
        svcMap.set(s.id, { name: s.name, duration_minutes: s.duration_minutes, price_cents: s.price_cents });
      }
    }

    const shopsSummaryMap = new Map<number, { shop_id: number; shop_name: string; shop_slug: string; visit_count: number; last_visit_at: string }>();
    for (const b of bookingRows) {
      const cur = shopsSummaryMap.get(b.shop_id);
      if (!cur) {
        const info = shopMap.get(b.shop_id);
        shopsSummaryMap.set(b.shop_id, {
          shop_id: b.shop_id,
          shop_name: info?.name ?? `Shop ${b.shop_id}`,
          shop_slug: info?.slug ?? "",
          visit_count: 1,
          last_visit_at: b.starts_at
        });
      } else {
        cur.visit_count += 1;
        if (b.starts_at > cur.last_visit_at) cur.last_visit_at = b.starts_at;
      }
    }

    const inShopHistory = bookingRows
      .filter((b) => b.shop_id === shop.id)
      .slice(0, 50)
      .map((b) => {
        const svc = b.salon_service_id != null ? svcMap.get(b.salon_service_id) : null;
        return {
          booking_id: b.id,
          starts_at: b.starts_at,
          status: b.status,
          service_name: svc?.name ?? null,
          duration_minutes: svc?.duration_minutes ?? null,
          price_cents: svc?.price_cents ?? null
        };
      });

    return okData(res, {
      customer_mobile: mobile,
      customer_name: bookingRows[0]?.customer_name ?? null,
      is_suspended: Boolean(status?.is_suspended),
      is_removed: Boolean(status?.is_removed),
      control_note: status?.note ?? null,
      control_updated_at: status?.updated_at ?? null,
      user:
        userRow.data != null
          ? {
              id: (userRow.data as { id: string }).id,
              name: (userRow.data as { name: string }).name,
              mobile: (userRow.data as { mobile: string }).mobile,
              is_locked: Boolean((userRow.data as { is_locked: boolean }).is_locked),
              created_at: (userRow.data as { created_at: string }).created_at
            }
          : null,
      shops: [...shopsSummaryMap.values()].sort((a, b) => (a.last_visit_at < b.last_visit_at ? 1 : -1)),
      current_shop_service_history: inShopHistory
    });
  });

  r.patch("/my/shop/customers/:mobile/status", async (req: Request, res: Response) => {
    const { shop, user } = req.salon!;
    const allowed = await canManageCustomers(user, shop.id);
    if (!allowed) return fail(res, 403, "Only owner or manager can manage customers.");

    const mobile = decodeURIComponent(req.params.mobile);
    if (!mobile) return fail(res, 422, "Invalid mobile.");
    const parsed = z
      .object({
        action: z.enum(["suspend", "unsuspend", "remove", "restore"]),
        note: z.string().max(500).nullable().optional()
      })
      .safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const existing = await supabaseAdmin
      .from("shop_customer_controls")
      .select("id,is_suspended,is_removed")
      .eq("shop_id", shop.id)
      .eq("customer_mobile", mobile)
      .maybeSingle();
    const base = (existing.data as { id: number; is_suspended: boolean; is_removed: boolean } | null) ?? null;
    const merged = {
      is_suspended: parsed.data.action === "unsuspend" ? false : parsed.data.action === "suspend" ? true : Boolean(base?.is_suspended),
      is_removed: parsed.data.action === "restore" ? false : parsed.data.action === "remove" ? true : Boolean(base?.is_removed)
    };

    const upsert = await supabaseAdmin.from("shop_customer_controls").upsert(
      {
        shop_id: shop.id,
        customer_mobile: mobile,
        is_suspended: merged.is_suspended,
        is_removed: merged.is_removed,
        note: parsed.data.note ?? null,
        updated_at: new Date().toISOString()
      },
      { onConflict: "shop_id,customer_mobile" }
    );
    if (upsert.error) return fail(res, 500, "Could not update customer status.");

    await notifyCustomerStatusChange({
      shopId: shop.id,
      customerMobile: mobile,
      action: parsed.data.action,
      note: parsed.data.note ?? null
    });

    return okData(res, {
      customer_mobile: mobile,
      is_suspended: merged.is_suspended,
      is_removed: merged.is_removed
    });
  });

  r.get("/my/shop/services-catalog", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const rows = await supabaseAdmin
      .from("salon_services")
      .select("id,name,category,duration_minutes,buffer_after_minutes,price_cents,is_active,sort_order")
      .eq("shop_id", shop.id)
      .order("sort_order");
    return okData(res, rows.data ?? []);
  });

  r.post("/my/shop/services-catalog", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    if (user.role === "barber") return fail(res, 403, "Only owner or manager can manage catalog.");
    const schema = z.object({
      name: z.string().max(255),
      category: z.string().max(64).nullable().optional(),
      duration_minutes: z.number().int().min(5).max(480),
      buffer_after_minutes: z.number().int().min(0).max(120).optional(),
      price_cents: z.number().int().min(0).nullable().optional(),
      is_active: z.boolean().optional(),
      sort_order: z.number().int().min(0).max(65535).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const ins = await supabaseAdmin
      .from("salon_services")
      .insert({
        shop_id: shop.id,
        name: parsed.data.name,
        category: parsed.data.category ?? null,
        duration_minutes: parsed.data.duration_minutes,
        buffer_after_minutes: parsed.data.buffer_after_minutes ?? 0,
        price_cents: parsed.data.price_cents ?? null,
        is_active: parsed.data.is_active ?? true,
        sort_order: parsed.data.sort_order ?? 0
      })
      .select("id,name,category,duration_minutes,buffer_after_minutes,price_cents,is_active,sort_order")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create service.");
    return okData(res, ins.data, 201);
  });

  r.patch("/my/shop/services-catalog/:serviceId", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    if (user.role === "barber") return fail(res, 403, "Only owner or manager can manage catalog.");
    const serviceId = Number(req.params.serviceId);
    const partial = z
      .object({
        name: z.string().max(255).optional(),
        category: z.string().max(64).nullable().optional(),
        duration_minutes: z.number().int().min(5).max(480).optional(),
        buffer_after_minutes: z.number().int().min(0).max(120).optional(),
        price_cents: z.number().int().min(0).nullable().optional(),
        is_active: z.boolean().optional(),
        sort_order: z.number().int().min(0).max(65535).optional()
      })
      .safeParse(req.body);
    if (!partial.success) return fail(res, 422, "Validation failed.");
    const patch = partial.data as Record<string, unknown>;
    const upd = await supabaseAdmin.from("salon_services").update(patch).eq("id", serviceId).eq("shop_id", shop.id).select("*").single();
    if (upd.error || !upd.data) return fail(res, 404, "Not found.");
    return okData(res, upd.data);
  });

  r.delete("/my/shop/services-catalog/:serviceId", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    if (user.role === "barber") return fail(res, 403, "Only owner or manager can manage catalog.");
    const serviceId = Number(req.params.serviceId);
    const bk = await supabaseAdmin.from("salon_bookings").select("id").eq("salon_service_id", serviceId).limit(1).maybeSingle();
    if (bk.data) {
      await supabaseAdmin.from("salon_services").update({ is_active: false }).eq("id", serviceId).eq("shop_id", shop.id);
      const fresh = await supabaseAdmin.from("salon_services").select("*").eq("id", serviceId).single();
      return res.json({ message: "Service has bookings; it was deactivated instead of deleted.", data: fresh.data });
    }
    await supabaseAdmin.from("salon_staff_services").delete().eq("service_id", serviceId);
    await supabaseAdmin.from("salon_services").delete().eq("id", serviceId).eq("shop_id", shop.id);
    return res.json({ message: "Service removed." });
  });

  r.get("/my/shop/staff-catalog", async (req: Request, res: Response) => {
    const { shop, user, staffScopeId } = req.salon!;
    let q = supabaseAdmin.from("salon_staff").select("id").eq("shop_id", shop.id).order("sort_order");
    if (staffScopeId != null) q = q.eq("id", staffScopeId);
    const ids = await q;
    const out: Record<string, unknown>[] = [];
    for (const row of (ids.data ?? []) as { id: number }[]) {
      const r2 = await staffCatalogRow(row.id);
      if (r2) out.push(r2);
    }
    if (staffScopeId == null) out.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return okData(res, out);
  });

  r.post("/my/shop/staff-catalog", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    const role = await shopMemberRole(user.id, shop.id);
    if (user.role !== "super_admin" && !["owner", "manager"].includes(role ?? "")) {
      return fail(res, 403, "Only owner or manager can manage staff.");
    }
    const schema = z.object({
      name: z.string().max(255),
      position_title: z.string().max(128).nullable().optional(),
      staff_role: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
      address: z.string().nullable().optional(),
      age: z.number().int().nullable().optional(),
      experience_years: z.number().int().nullable().optional(),
      work_mobile: z.string().nullable().optional(),
      emergency_contact_name: z.string().nullable().optional(),
      emergency_contact_phone: z.string().nullable().optional(),
      specialties: z.array(z.string()).optional(),
      is_active: z.boolean().optional(),
      sort_order: z.number().int().optional(),
      service_ids: z.array(z.number()).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const ins = await supabaseAdmin
      .from("salon_staff")
      .insert({
        shop_id: shop.id,
        name: parsed.data.name,
        position_title: parsed.data.position_title ?? null,
        staff_role: parsed.data.staff_role ?? null,
        bio: parsed.data.bio ?? null,
        address: parsed.data.address ?? null,
        age: parsed.data.age ?? null,
        experience_years: parsed.data.experience_years ?? null,
        work_mobile: parsed.data.work_mobile ?? null,
        emergency_contact_name: parsed.data.emergency_contact_name ?? null,
        emergency_contact_phone: parsed.data.emergency_contact_phone ?? null,
        specialties: parsed.data.specialties ?? [],
        is_active: parsed.data.is_active ?? true,
        sort_order: parsed.data.sort_order ?? 0
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create staff.");
    const sid = (ins.data as { id: number }).id;
    if (parsed.data.service_ids?.length) {
      const rows = parsed.data.service_ids.map((service_id) => ({ shop_id: shop.id, staff_id: sid, service_id }));
      await supabaseAdmin.from("salon_staff_services").insert(rows);
    }
    const row = await staffCatalogRow(sid);
    return okData(res, row, 201);
  });

  r.post("/my/shop/staff-with-account", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    const role = await shopMemberRole(user.id, shop.id);
    if (user.role !== "super_admin" && !["owner", "manager"].includes(role ?? "")) {
      return fail(res, 403, "Only owner or manager can create staff accounts.");
    }
    const schema = z.object({
      name: z.string(),
      mobile: z.string(),
      password: z.string().min(8),
      password_confirmation: z.string().min(8),
      position_title: z.string().nullable().optional(),
      staff_role: z.string().nullable().optional(),
      bio: z.string().nullable().optional(),
      specialties: z.array(z.string()).optional(),
      service_ids: z.array(z.number()).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    if (parsed.data.password !== parsed.data.password_confirmation) {
      return res.status(422).json({ message: "Validation failed.", errors: { password: ["Password confirmation does not match."] } });
    }
    const mobile = normalizeMobile(parsed.data.mobile);
    if (!mobile) return fail(res, 422, "Invalid mobile number.");
    const exists = await supabaseAdmin.from("users").select("id").eq("mobile", mobile).maybeSingle();
    if (exists.data) return res.status(422).json({ message: "This mobile number is already registered." });
    const hash = await bcrypt.hash(parsed.data.password, 10);
    const newUser = await supabaseAdmin
      .from("users")
      .insert({ name: parsed.data.name, mobile, password_hash: hash, role: "barber" })
      .select("id")
      .single();
    if (newUser.error || !newUser.data) return fail(res, 500, "Could not create user.");
    const uid = (newUser.data as { id: string }).id;
    const ins = await supabaseAdmin
      .from("salon_staff")
      .insert({
        shop_id: shop.id,
        user_id: uid,
        name: parsed.data.name,
        position_title: parsed.data.position_title ?? null,
        staff_role: parsed.data.staff_role ?? null,
        bio: parsed.data.bio ?? null,
        specialties: parsed.data.specialties ?? [],
        is_active: true,
        sort_order: 0
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) {
      const msg = String(ins.error?.message ?? "");
      if (msg.includes("uq_staff_user_single_shop")) {
        return fail(res, 422, "This staff login is already linked to another shop.");
      }
      return fail(res, 500, "Could not create staff profile.");
    }
    const sid = (ins.data as { id: number }).id;
    if (parsed.data.service_ids?.length) {
      const rows = parsed.data.service_ids.map((service_id) => ({ shop_id: shop.id, staff_id: sid, service_id }));
      await supabaseAdmin.from("salon_staff_services").insert(rows);
    }
    const row = await staffCatalogRow(sid);
    return okData(res, row, 201);
  });

  r.patch("/my/shop/staff-catalog/:staffId", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    const role = await shopMemberRole(user.id, shop.id);
    if (user.role !== "super_admin" && !["owner", "manager"].includes(role ?? "")) {
      return fail(res, 403, "Only owner or manager can manage staff.");
    }
    const staffId = Number(req.params.staffId);
    const patch = (req.body ?? {}) as Record<string, unknown>;
    const cur = await supabaseAdmin.from("salon_staff").select("*").eq("id", staffId).eq("shop_id", shop.id).maybeSingle();
    if (!cur.data) return fail(res, 404, "Not found.");
    const allowed = [
      "name",
      "position_title",
      "staff_role",
      "bio",
      "address",
      "age",
      "experience_years",
      "work_mobile",
      "emergency_contact_name",
      "emergency_contact_phone",
      "specialties",
      "is_active",
      "sort_order"
    ];
    const upd: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in patch) upd[k] = patch[k];
    }
    if (Object.keys(upd).length) {
      await supabaseAdmin.from("salon_staff").update(upd).eq("id", staffId).eq("shop_id", shop.id);
    }
    const uid = (cur.data as { user_id: string | null }).user_id;
    if (uid && (patch.mobile || patch.password)) {
      const uu: Record<string, unknown> = {};
      if (typeof patch.name === "string") uu.name = patch.name;
      if (patch.mobile) {
        const m = normalizeMobile(String(patch.mobile));
        if (!m) return fail(res, 422, "Invalid mobile number.");
        const clash = await supabaseAdmin.from("users").select("id").eq("mobile", m).neq("id", uid).maybeSingle();
        if (clash.data) return res.status(422).json({ message: "This mobile number is already registered." });
        uu.mobile = m;
      }
      if (patch.password) {
        if (String(patch.password) !== String(patch.password_confirmation ?? "")) {
          return res.status(422).json({ errors: { password: ["Password confirmation does not match."] } });
        }
        uu.password_hash = await bcrypt.hash(String(patch.password), 10);
      }
      if (Object.keys(uu).length) await supabaseAdmin.from("users").update(uu).eq("id", uid);
    }
    if (Array.isArray(patch.service_ids)) {
      await supabaseAdmin.from("salon_staff_services").delete().eq("staff_id", staffId);
      const rows = (patch.service_ids as number[]).map((service_id) => ({ shop_id: shop.id, staff_id: staffId, service_id }));
      if (rows.length) await supabaseAdmin.from("salon_staff_services").insert(rows);
    }
    const row = await staffCatalogRow(staffId);
    return okData(res, row);
  });

  r.delete("/my/shop/staff-catalog/:staffId", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    const role = await shopMemberRole(user.id, shop.id);
    if (user.role !== "super_admin" && !["owner", "manager"].includes(role ?? "")) {
      return fail(res, 403, "Only owner or manager can manage staff.");
    }
    const staffId = Number(req.params.staffId);
    const bk = await supabaseAdmin.from("salon_bookings").select("id").eq("salon_staff_id", staffId).limit(1).maybeSingle();
    if (bk.data) {
      await supabaseAdmin.from("salon_staff").update({ is_active: false }).eq("id", staffId).eq("shop_id", shop.id);
      const row = await staffCatalogRow(staffId);
      return res.json({ message: "Staff member has bookings; deactivated instead of deleted.", data: row });
    }
    await supabaseAdmin.from("salon_staff_services").delete().eq("staff_id", staffId);
    await supabaseAdmin.from("salon_staff").delete().eq("id", staffId).eq("shop_id", shop.id);
    return res.json({ message: "Team member removed." });
  });

  r.get("/my/shop/bookings", async (req: Request, res: Response) => {
    const { shop, staffScopeId } = req.salon!;
    const from = typeof req.query.from === "string" ? req.query.from : null;
    const to = typeof req.query.to === "string" ? req.query.to : null;
    const status = typeof req.query.status === "string" ? req.query.status : null;
    let q = supabaseAdmin
      .from("salon_bookings")
      .select("id")
      .eq("shop_id", shop.id)
      .order("starts_at")
      .limit(500);
    if (from) q = q.gte("starts_at", from);
    if (to) q = q.lte("starts_at", to);
    if (status) q = q.eq("status", status);
    if (staffScopeId != null) q = q.eq("salon_staff_id", staffScopeId);
    const ids = await q;
    const list: Record<string, unknown>[] = [];
    for (const row of (ids.data ?? []) as { id: number }[]) {
      const b = await bookingToRow(row.id);
      if (b) list.push(b);
    }
    return okData(res, list);
  });

  r.post("/my/shop/bookings", async (req: Request, res: Response) => {
    const { shop, staffScopeId } = req.salon!;
    const schema = z.object({
      customer_name: z.string(),
      customer_mobile: z.string(),
      salon_service_id: z.number().int(),
      salon_staff_id: z.number().int().nullable().optional(),
      starts_at: z.string(),
      status: z.string().optional(),
      notes: z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const mobile = normalizeMobile(parsed.data.customer_mobile);
    if (!mobile) return fail(res, 422, "Invalid mobile number.");
    const ctrl = await supabaseAdmin
      .from("shop_customer_controls")
      .select("is_suspended,is_removed")
      .eq("shop_id", shop.id)
      .eq("customer_mobile", mobile)
      .maybeSingle();
    if ((ctrl.data as { is_suspended?: boolean; is_removed?: boolean } | null)?.is_removed) {
      return fail(res, 403, "Customer is removed from this shop.");
    }
    if ((ctrl.data as { is_suspended?: boolean; is_removed?: boolean } | null)?.is_suspended) {
      return fail(res, 403, "Customer is suspended in this shop.");
    }
    const svc = await supabaseAdmin
      .from("salon_services")
      .select("*")
      .eq("id", parsed.data.salon_service_id)
      .eq("shop_id", shop.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!svc.data) return fail(res, 422, "Invalid service.");
    const duration = Math.max(1, (svc.data as { duration_minutes: number }).duration_minutes);
    const starts = new Date(parsed.data.starts_at);
    const ends = new Date(starts.getTime() + duration * 60_000);
    let staffId = staffScopeId ?? parsed.data.salon_staff_id ?? null;
    if (staffId == null) {
      const fb = await supabaseAdmin.from("salon_staff").select("id").eq("shop_id", shop.id).eq("is_active", true).limit(1).maybeSingle();
      staffId = fb.data?.id ?? null;
    }
    if (staffId == null) return fail(res, 422, "No staff.");
    const stCheck = await supabaseAdmin.from("salon_staff").select("id").eq("id", staffId).eq("shop_id", shop.id).maybeSingle();
    if (!stCheck.data) return fail(res, 422, "Invalid staff.");
    const ins = await supabaseAdmin
      .from("salon_bookings")
      .insert({
        shop_id: shop.id,
        customer_name: parsed.data.customer_name,
        customer_mobile: mobile,
        salon_service_id: parsed.data.salon_service_id,
        salon_staff_id: staffId,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: parsed.data.status ?? "confirmed",
        source: "walk_in",
        notes: parsed.data.notes ?? null
      })
      .select("id")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create booking.");
    const row = await bookingToRow((ins.data as { id: number }).id);
    return okData(res, row, 201);
  });

  r.patch("/my/shop/bookings/:bookingId", async (req: Request, res: Response) => {
    const { shop, staffScopeId } = req.salon!;
    const bookingId = Number(req.params.bookingId);
    const b = await supabaseAdmin.from("salon_bookings").select("*").eq("id", bookingId).eq("shop_id", shop.id).maybeSingle();
    if (!b.data) return fail(res, 404, "Not found.");
    const booking = b.data as { salon_staff_id: number; status: string };
    if (staffScopeId != null && booking.salon_staff_id !== staffScopeId) return fail(res, 403, "You can only edit your own bookings.");
    const patch = req.body as Record<string, unknown>;
    const upd: Record<string, unknown> = {};
    if (typeof patch.notes === "string" || patch.notes === null) upd.notes = patch.notes;
    if (typeof patch.status === "string") upd.status = patch.status;
    if (typeof patch.starts_at === "string" || patch.salon_staff_id !== undefined) {
      const cur = b.data as { salon_service_id: number; salon_staff_id: number; starts_at: string };
      const svc = await supabaseAdmin.from("salon_services").select("*").eq("id", cur.salon_service_id).single();
      const duration = Math.max(1, (svc.data as { duration_minutes: number }).duration_minutes);
      const starts = new Date(typeof patch.starts_at === "string" ? patch.starts_at : cur.starts_at);
      let sid = cur.salon_staff_id;
      if (patch.salon_staff_id !== undefined) {
        sid = patch.salon_staff_id === null ? cur.salon_staff_id : Number(patch.salon_staff_id);
      }
      if (staffScopeId != null) sid = staffScopeId;
      const stOk = await supabaseAdmin.from("salon_staff").select("id").eq("id", sid).eq("shop_id", shop.id).maybeSingle();
      if (!stOk.data) return fail(res, 422, "Invalid staff.");
      upd.salon_staff_id = sid;
      upd.starts_at = starts.toISOString();
      upd.ends_at = new Date(starts.getTime() + duration * 60_000).toISOString();
    }
    await supabaseAdmin.from("salon_bookings").update(upd).eq("id", bookingId);
    const nextStatus = typeof upd.status === "string" ? upd.status : booking.status;
    if (nextStatus !== booking.status && nextStatus !== "confirmed" && nextStatus !== "completed") {
      await notifyCustomerBookingStatusChange({
        bookingId,
        fromStatus: booking.status,
        toStatus: nextStatus
      });
    }
    if (nextStatus === "confirmed" && booking.status !== "confirmed") {
      await notifyCustomerBookingEvent({ bookingId, type: "booking_confirmed" });
    }
    if (nextStatus === "completed" && booking.status !== "completed") {
      await notifyCustomerBookingEvent({ bookingId, type: "service_completed_review" });
    }
    const row = await bookingToRow(bookingId);
    return okData(res, row);
  });

  r.get("/my/shop/blocked-slots", async (req: Request, res: Response) => {
    const { shop, staffScopeId } = req.salon!;
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!from || !to) return fail(res, 422, "from and to required.");
    let q = supabaseAdmin
      .from("salon_blocked_slots")
      .select("id,salon_staff_id,starts_at,ends_at,kind,reason")
      .eq("shop_id", shop.id)
      .lt("starts_at", new Date(to).toISOString())
      .gt("ends_at", new Date(from).toISOString())
      .order("starts_at");
    if (staffScopeId != null) q = q.eq("salon_staff_id", staffScopeId);
    const rows = await q;
    const data = [];
    for (const row of (rows.data ?? []) as {
      id: number;
      salon_staff_id: number | null;
      starts_at: string;
      ends_at: string;
      kind: string;
      reason: string | null;
    }[]) {
      let nm = "Staff";
      if (row.salon_staff_id) {
        const sn = await supabaseAdmin.from("salon_staff").select("name").eq("id", row.salon_staff_id).maybeSingle();
        nm = (sn.data as { name: string } | null)?.name ?? "Staff";
      }
      data.push({
        id: row.id,
        salon_staff_id: row.salon_staff_id,
        staff: row.salon_staff_id ? { id: row.salon_staff_id, name: nm } : null,
        scope: row.salon_staff_id ? "staff" : "shop",
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        kind: row.kind,
        reason: row.reason
      });
    }
    return okData(res, data);
  });

  r.post("/my/shop/blocked-slots", async (req: Request, res: Response) => {
    const { shop, staffScopeId } = req.salon!;
    const schema = z.object({
      salon_staff_id: z.number().int().nullable().optional(),
      starts_at: z.string(),
      ends_at: z.string(),
      kind: z.string(),
      reason: z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    let sid = parsed.data.salon_staff_id ?? null;
    if (staffScopeId != null) sid = staffScopeId;
    if (sid != null) {
      const ok = await supabaseAdmin.from("salon_staff").select("id").eq("id", sid).eq("shop_id", shop.id).maybeSingle();
      if (!ok.data) return fail(res, 422, "Invalid staff.");
    }
    const ins = await supabaseAdmin
      .from("salon_blocked_slots")
      .insert({
        shop_id: shop.id,
        salon_staff_id: sid,
        starts_at: parsed.data.starts_at,
        ends_at: parsed.data.ends_at,
        kind: parsed.data.kind,
        reason: parsed.data.reason ?? null
      })
      .select("id,salon_staff_id,starts_at,ends_at,kind,reason")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create block.");
    const row = ins.data as {
      id: number;
      salon_staff_id: number | null;
      starts_at: string;
      ends_at: string;
      kind: string;
      reason: string | null;
    };
    let staffName = "Staff";
    if (row.salon_staff_id) {
      const sn = await supabaseAdmin.from("salon_staff").select("name").eq("id", row.salon_staff_id).maybeSingle();
      staffName = (sn.data as { name: string } | null)?.name ?? "Staff";
    }
    return okData(
      res,
      {
        id: row.id,
        salon_staff_id: row.salon_staff_id,
        staff: row.salon_staff_id ? { id: row.salon_staff_id, name: staffName } : null,
        scope: row.salon_staff_id ? "staff" : "shop",
        starts_at: row.starts_at,
        ends_at: row.ends_at,
        kind: row.kind,
        reason: row.reason
      },
      201
    );
  });

  r.delete("/my/shop/blocked-slots/:id", async (req: Request, res: Response) => {
    const { shop, staffScopeId } = req.salon!;
    const id = Number(req.params.id);
    const row = await supabaseAdmin.from("salon_blocked_slots").select("*").eq("id", id).eq("shop_id", shop.id).maybeSingle();
    if (!row.data) return fail(res, 404, "Not found.");
    if (staffScopeId != null && (row.data as { salon_staff_id: number | null }).salon_staff_id !== staffScopeId) {
      return fail(res, 403, "Forbidden.");
    }
    await supabaseAdmin.from("salon_blocked_slots").delete().eq("id", id).eq("shop_id", shop.id);
    return res.json({ message: "Deleted." });
  });

  r.get("/my/shop/branches", async (req: Request, res: Response) => {
    const { user } = req.salon!;
    let q = supabaseAdmin.from("shops").select("*").order("parent_shop_id").order("name");
    if (user.role !== "super_admin") q = q.eq("owner_user_id", user.id);
    const rows = await q;
    return okData(res, rows.data ?? []);
  });

  r.post("/my/shop/branches", async (req: Request, res: Response) => {
    const { user, shop } = req.salon!;
    if (user.role !== "super_admin" && shop.owner_user_id !== user.id) return fail(res, 403, "Forbidden.");
    const schema = z.object({
      name: z.string(),
      slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
      description: z.string().nullable().optional(),
      parent_shop_id: z.number().int().nullable().optional(),
      address: z.string().nullable().optional(),
      phone: z.string().nullable().optional(),
      latitude: z.union([z.string(), z.number()]).nullable().optional(),
      longitude: z.union([z.string(), z.number()]).nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const slugCheck = await supabaseAdmin.from("shops").select("id").eq("slug", parsed.data.slug).maybeSingle();
    if (slugCheck.data) return res.status(422).json({ message: "Slug already taken." });
    if (parsed.data.parent_shop_id != null) {
      const p = await supabaseAdmin.from("shops").select("id,owner_user_id").eq("id", parsed.data.parent_shop_id).maybeSingle();
      if (!p.data || (p.data as { owner_user_id: string }).owner_user_id !== user.id) return fail(res, 422, "Invalid parent shop.");
    }
    const ins = await supabaseAdmin
      .from("shops")
      .insert({
        owner_user_id: user.id,
        parent_shop_id: parsed.data.parent_shop_id ?? null,
        name: parsed.data.name,
        slug: parsed.data.slug,
        description: parsed.data.description ?? null,
        address: parsed.data.address ?? null,
        phone: parsed.data.phone ?? null,
        latitude: parsed.data.latitude != null ? String(parsed.data.latitude) : null,
        longitude: parsed.data.longitude != null ? String(parsed.data.longitude) : null,
        is_active: true,
        settings: {}
      })
      .select("*")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create branch.");
    const newId = (ins.data as { id: number }).id;
    await supabaseAdmin.from("subscriptions").insert({
      shop_id: newId,
      plan_key: "starter",
      status: "active",
      trial_ends_at: null,
      current_period_end: new Date(Date.now() + 365 * 86400_000).toISOString()
    });
    return okData(res, ins.data, 201);
  });

  r.patch("/my/shop/branches/:shopId", async (req: Request, res: Response) => {
    const { user } = req.salon!;
    const shopId = Number(req.params.shopId);
    const own = await supabaseAdmin.from("shops").select("*").eq("id", shopId).eq("owner_user_id", user.id).maybeSingle();
    if (!own.data) return fail(res, 404, "Not found.");
    const patch = (req.body ?? {}) as Record<string, unknown>;
    const allowed = ["name", "slug", "description", "address", "phone", "is_active", "latitude", "longitude", "photos"];
    const upd: Record<string, unknown> = {};
    for (const k of allowed) {
      if (k in patch) upd[k] = patch[k];
    }
    const saved = await supabaseAdmin.from("shops").update(upd).eq("id", shopId).select("*").single();
    return okData(res, saved.data);
  });

  r.get("/my/shop/inventory", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const rows = await supabaseAdmin.from("inventory_items").select("*").eq("shop_id", shop.id).order("name");
    const data = (rows.data ?? []).map((x: Record<string, unknown>) => ({
      ...x,
      quantity: String(x.quantity ?? "0"),
      low_stock_threshold: x.low_stock_threshold != null ? String(x.low_stock_threshold) : null
    }));
    return okData(res, data);
  });

  r.post("/my/shop/inventory", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const schema = z.object({
      name: z.string(),
      quantity: z.number().min(0),
      unit: z.string().optional(),
      low_stock_threshold: z.number().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const ins = await supabaseAdmin
      .from("inventory_items")
      .insert({
        shop_id: shop.id,
        name: parsed.data.name,
        quantity: parsed.data.quantity,
        unit: parsed.data.unit ?? "unit",
        low_stock_threshold: parsed.data.low_stock_threshold ?? null
      })
      .select("*")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create.");
    const x = ins.data as Record<string, unknown>;
    return okData(
      res,
      {
        ...x,
        quantity: String(x.quantity ?? "0"),
        low_stock_threshold: x.low_stock_threshold != null ? String(x.low_stock_threshold) : null
      },
      201
    );
  });

  r.patch("/my/shop/inventory/:id", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const id = Number(req.params.id);
    const partial = z
      .object({
        name: z.string().optional(),
        quantity: z.number().min(0).optional(),
        unit: z.string().max(32).optional(),
        low_stock_threshold: z.number().nullable().optional()
      })
      .safeParse(req.body);
    if (!partial.success) return fail(res, 422, "Validation failed.");
    const saved = await supabaseAdmin
      .from("inventory_items")
      .update(partial.data as Record<string, unknown>)
      .eq("id", id)
      .eq("shop_id", shop.id)
      .select("*")
      .single();
    if (saved.error || !saved.data) return fail(res, 404, "Not found.");
    const x = saved.data as Record<string, unknown>;
    return okData(res, {
      ...x,
      quantity: String(x.quantity ?? "0"),
      low_stock_threshold: x.low_stock_threshold != null ? String(x.low_stock_threshold) : null
    });
  });

  r.delete("/my/shop/inventory/:id", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    await supabaseAdmin.from("inventory_items").delete().eq("id", Number(req.params.id)).eq("shop_id", shop.id);
    return res.json({ message: "Deleted." });
  });

  r.get("/my/shop/reviews", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const rows = await supabaseAdmin
      .from("salon_reviews")
      .select("id,rating,comment,owner_reply,created_at,salon_staff_id,customer_user_id,salon_staff(name),users!salon_reviews_customer_user_id_fkey(name)")
      .eq("shop_id", shop.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const data = (rows.data ?? []).map(
      (r: {
        id: number;
        rating: number;
        comment: string | null;
        owner_reply: string | null;
        created_at: string | null;
        salon_staff_id: number | null;
        customer_user_id: string | null;
        salon_staff: { name: string }[] | null;
        users: { name: string }[] | null;
      }) => ({
        id: r.id,
        rating: Number(r.rating),
        comment: r.comment ?? null,
        owner_reply: r.owner_reply ?? null,
        created_at: r.created_at ?? null,
        staff: r.salon_staff_id ? { id: r.salon_staff_id, name: r.salon_staff?.[0]?.name ?? "Barber" } : null,
        customer: r.customer_user_id ? { id: 0, name: r.users?.[0]?.name ?? "Customer" } : null
      })
    );
    return okData(res, data);
  });

  r.patch("/my/shop/reviews/:reviewId", async (req: Request, res: Response) => {
    const { shop, user } = req.salon!;
    const reviewId = Number(req.params.reviewId);
    const schema = z.object({ owner_reply: z.string().max(5000) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const upd = await supabaseAdmin
      .from("salon_reviews")
      .update({ owner_reply: parsed.data.owner_reply })
      .eq("id", reviewId)
      .eq("shop_id", shop.id)
      .select("*")
      .single();
    if (upd.error || !upd.data) return fail(res, 404, "Not found.");
    const reply = parsed.data.owner_reply.trim();
    if (reply.length > 0) {
      await notifyCustomerReviewReply({
        reviewId,
        ownerReply: reply,
        actorName: user.name
      });
    }
    return okData(res, upd.data);
  });

  r.get("/my/shop/analytics/summary", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const from = String(req.query.from ?? "");
    const to = String(req.query.to ?? "");
    if (!from || !to) return fail(res, 422, "from and to required.");
    const fromD = new Date(from);
    const toD = new Date(to);
    const list = await supabaseAdmin
      .from("salon_bookings")
      .select("status,starts_at,salon_service_id,salon_staff_id")
      .eq("shop_id", shop.id)
      .gte("starts_at", fromD.toISOString())
      .lte("starts_at", toD.toISOString())
      .limit(5000);
    const bookings = (list.data ?? []) as {
      status: string;
      starts_at: string;
      salon_service_id: number;
      salon_staff_id: number;
    }[];
    const svcIds = [...new Set(bookings.map((b) => b.salon_service_id))];
    const staffIds = [...new Set(bookings.map((b) => b.salon_staff_id))];
    const svcName = new Map<number, { name: string; price_cents: number }>();
    if (svcIds.length) {
      const sv = await supabaseAdmin.from("salon_services").select("id,name,price_cents").in("id", svcIds);
      for (const s of (sv.data ?? []) as { id: number; name: string; price_cents: number | null }[]) {
        svcName.set(s.id, { name: s.name, price_cents: Number(s.price_cents ?? 0) });
      }
    }
    const stName = new Map<number, string>();
    if (staffIds.length) {
      const st = await supabaseAdmin.from("salon_staff").select("id,name").in("id", staffIds);
      for (const s of (st.data ?? []) as { id: number; name: string }[]) {
        stName.set(s.id, s.name);
      }
    }
    const byStatus: Record<string, number> = {};
    let revenue = 0;
    const svcCount = new Map<string, number>();
    const svcRev = new Map<string, { bookings: number; revenue_cents: number }>();
    const staffCount = new Map<string, number>();
    for (const b of bookings) {
      byStatus[b.status] = (byStatus[b.status] ?? 0) + 1;
      if (b.status === "completed") {
        const svc = svcName.get(b.salon_service_id);
        const cents = svc?.price_cents ?? 0;
        revenue += cents;
        const n = svc?.name ?? "";
        svcCount.set(n, (svcCount.get(n) ?? 0) + 1);
        const cur = svcRev.get(n) ?? { bookings: 0, revenue_cents: 0 };
        cur.bookings += 1;
        cur.revenue_cents += cents;
        svcRev.set(n, cur);
      }
      const sn = stName.get(b.salon_staff_id) ?? "";
      if (sn) staffCount.set(sn, (staffCount.get(sn) ?? 0) + 1);
    }
    const total = bookings.length;
    const cancelled = (byStatus.cancelled ?? 0) + (byStatus.no_show ?? 0);
    return okData(res, {
      from: fromD.toISOString(),
      to: toD.toISOString(),
      total_bookings: total,
      by_status: byStatus,
      revenue_cents_completed: revenue,
      top_services: [...svcCount.entries()].map(([name, bookings]) => ({ name, bookings })).slice(0, 8),
      top_services_revenue: [...svcRev.values()].slice(0, 8),
      top_staff: [...staffCount.entries()].map(([name, bookings]) => ({ name, bookings })).slice(0, 8),
      cancellation_rate_percent: total > 0 ? Math.round((cancelled / total) * 1000) / 10 : 0
    });
  });

  r.get("/my/shop/payments", async (req: Request, res: Response) => {
    const { shop, user } = req.salon!;
    if (user.role === "barber") return fail(res, 403, "Staff accounts cannot manage shop payments.");
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = Math.min(50, Math.max(5, Number(req.query.per_page ?? 20)));
    const from = (page - 1) * perPage;
    const to = from + perPage - 1;
    let q = supabaseAdmin
      .from("salon_payments")
      .select("*", { count: "exact" })
      .eq("shop_id", shop.id)
      .order("id", { ascending: false })
      .range(from, to);
    if (typeof req.query.status === "string") q = q.eq("status", req.query.status);
    const rows = await q;
    const total = rows.count ?? 0;
    const lastPage = Math.max(1, Math.ceil(total / perPage));
    return res.json({
      data: rows.data ?? [],
      meta: { current_page: page, last_page: lastPage, per_page: perPage, total }
    });
  });

  r.post("/my/shop/payments", async (req: Request, res: Response) => {
    const { shop, user } = req.salon!;
    if (user.role === "barber") return fail(res, 403, "Staff accounts cannot manage shop payments.");
    const schema = z.object({
      amount_cents: z.number().int().positive(),
      method: z.string(),
      currency: z.string().optional(),
      salon_booking_id: z.number().int().nullable().optional(),
      transaction_id: z.string().nullable().optional(),
      status: z.enum(["pending", "completed", "failed"]).optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    if (parsed.data.salon_booking_id != null) {
      const bk = await supabaseAdmin.from("salon_bookings").select("id").eq("id", parsed.data.salon_booking_id).eq("shop_id", shop.id).maybeSingle();
      if (!bk.data) return fail(res, 422, "Booking not found for this shop.");
    }
    const ins = await supabaseAdmin
      .from("salon_payments")
      .insert({
        shop_id: shop.id,
        salon_booking_id: parsed.data.salon_booking_id ?? null,
        method: parsed.data.method,
        amount_cents: parsed.data.amount_cents,
        currency: parsed.data.currency ?? "BDT",
        transaction_id: parsed.data.transaction_id ?? null,
        status: parsed.data.status ?? "completed",
        metadata: { source: "manual_entry" }
      })
      .select("*")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create payment.");
    return okData(res, ins.data, 201);
  });

  r.patch("/my/shop/payments/:payment/refund", async (req: Request, res: Response) => {
    const { shop, user } = req.salon!;
    if (user.role === "barber") return fail(res, 403, "Staff accounts cannot manage shop payments.");
    const paymentId = Number(req.params.payment);
    const pay = await supabaseAdmin.from("salon_payments").select("*").eq("id", paymentId).eq("shop_id", shop.id).maybeSingle();
    if (!pay.data) return fail(res, 404, "Not found.");
    if ((pay.data as { status: string }).status === "refunded") return fail(res, 422, "Already refunded.");
    const upd = await supabaseAdmin.from("salon_payments").update({ status: "refunded" }).eq("id", paymentId).select("*").single();
    return okData(res, upd.data);
  });

  r.get("/my/shop/queue/manage", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const rows = await supabaseAdmin.from("queue_entries").select("*").eq("shop_id", shop.id).order("position");
    const raw = (rows.data ?? []) as {
      id: number;
      position: number;
      status: string;
      customer_name: string;
      estimated_wait_minutes: number | null;
      staff_id: number | null;
      customer_user_id: string | null;
      join_time: string | null;
    }[];
    const data = [];
    for (const row of raw) {
      let staffLabel: { id: number; name: string } | null = null;
      if (row.staff_id) {
        const sn = await supabaseAdmin.from("salon_staff").select("name").eq("id", row.staff_id).maybeSingle();
        staffLabel = { id: row.staff_id, name: (sn.data as { name: string } | null)?.name ?? "Staff" };
      }
      let custName = row.customer_name;
      if (row.customer_user_id) {
        const u = await supabaseAdmin.from("users").select("name").eq("id", row.customer_user_id).maybeSingle();
        if (u.data) custName = (u.data as { name: string }).name;
      }
      data.push({
        id: row.id,
        position: row.position,
        status: row.status,
        customer_name: row.customer_name,
        estimated_wait_minutes: row.estimated_wait_minutes,
        staff: staffLabel,
        customer: { id: 0, name: custName },
        join_time: row.join_time
      });
    }
    return okData(res, data);
  });

  r.patch("/my/shop/queue/:id/status", async (req: Request, res: Response) => {
    const { shop } = req.salon!;
    const id = Number(req.params.id);
    const schema = z.object({ status: z.enum(["waiting", "in_progress", "done", "cancelled"]) });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const upd = await supabaseAdmin
      .from("queue_entries")
      .update({ status: parsed.data.status })
      .eq("id", id)
      .eq("shop_id", shop.id)
      .select("*")
      .single();
    if (upd.error || !upd.data) return fail(res, 404, "Not found.");
    return okData(res, upd.data);
  });
}
