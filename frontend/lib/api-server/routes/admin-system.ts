import type { Request, Response, Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "../lib/supabase";
import { fail, okData } from "../lib/http";
import { verifyAccessToken, signAccessToken, issueRefreshToken, hashToken } from "../lib/jwt";
import { config } from "../config";
import { seedDefaultServicesForShop } from "../lib/default-services";

async function adminUser(req: Request): Promise<{ id: string; role: string; name: string; mobile: string } | null> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) return null;
  try {
    const payload = verifyAccessToken(auth.slice("Bearer ".length).trim());
    const u = await supabaseAdmin.from("users").select("id,role,name,mobile").eq("id", payload.sub).maybeSingle();
    const user = u.data as { id: string; role: string; name: string; mobile: string } | null;
    if (!user || user.role !== "super_admin") return null;
    return user;
  } catch {
    return null;
  }
}

function paginate<T>(items: T[], page: number, perPage: number) {
  const total = items.length;
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = (page - 1) * perPage;
  return {
    data: items.slice(from, from + perPage),
    current_page: page,
    last_page: lastPage,
    per_page: perPage,
    total
  };
}

async function logAudit(adminUserId: string, action: string, targetType?: string, targetId?: string, ip?: string | null) {
  await supabaseAdmin.from("audit_logs").insert({
    admin_user_id: adminUserId,
    action,
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    ip: ip ?? null
  });
}

export function mountAdminSystemRoutes(router: Router): void {
  router.use(async (req, res, next) => {
    const admin = await adminUser(req);
    if (!admin) return fail(res, 403, "Super admin required.");
    (req as Request & { superAdmin?: { id: string; role: string; name: string; mobile: string } }).superAdmin = admin;
    next();
  });

  router.get("/admin/general", async (_req, res) => {
    const row = await supabaseAdmin.from("platform_general").select("*").eq("id", 1).maybeSingle();
    if (!row.data) return fail(res, 500, "Platform settings missing.");
    return okData(res, row.data);
  });

  router.patch("/admin/general", async (req, res) => {
    const patch = req.body as Record<string, unknown>;
    const upd = await supabaseAdmin.from("platform_general").update(patch).eq("id", 1).select("*").single();
    if (upd.error || !upd.data) return fail(res, 500, "Could not update settings.");
    const admin = (req as Request & { superAdmin?: { id: string } }).superAdmin!;
    await logAudit(admin.id, "admin.general.update", "platform_general", "1", req.ip);
    return okData(res, upd.data);
  });

  router.get("/admin/subscription-plans", async (_req, res) => {
    const rows = await supabaseAdmin.from("subscription_plans").select("*").order("sort_order");
    return okData(res, rows.data ?? []);
  });

  router.post("/admin/subscription-plans", async (req, res) => {
    const body = req.body as Record<string, unknown>;
    const ins = await supabaseAdmin.from("subscription_plans").insert(body).select("*").single();
    if (ins.error || !ins.data) return fail(res, 422, ins.error?.message ?? "Could not create plan.");
    const admin = (req as Request & { superAdmin?: { id: string } }).superAdmin!;
    await logAudit(admin.id, "admin.plan.create", "subscription_plans", String((ins.data as { id: number }).id), req.ip);
    return okData(res, ins.data, 201);
  });

  router.patch("/admin/subscription-plans/:plan", async (req, res) => {
    const id = Number(req.params.plan);
    const upd = await supabaseAdmin.from("subscription_plans").update(req.body as Record<string, unknown>).eq("id", id).select("*").single();
    if (upd.error || !upd.data) return fail(res, 404, "Plan not found.");
    return okData(res, upd.data);
  });

  router.delete("/admin/subscription-plans/:plan", async (req, res) => {
    const id = Number(req.params.plan);
    await supabaseAdmin.from("subscription_plans").delete().eq("id", id);
    return res.json({ message: "Deleted." });
  });

  router.patch("/admin/shops/:shop/subscription", async (req, res) => {
    const shopId = Number(req.params.shop);
    const parsed = z.object({ subscription_plan_id: z.number().int() }).safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const plan = await supabaseAdmin.from("subscription_plans").select("slug").eq("id", parsed.data.subscription_plan_id).maybeSingle();
    if (!plan.data) return fail(res, 422, "Invalid plan.");
    const slug = (plan.data as { slug: string }).slug;
    const upd = await supabaseAdmin.from("subscriptions").update({ plan_key: slug }).eq("shop_id", shopId).select("*").maybeSingle();
    if (!upd.data) return fail(res, 404, "Subscription not found.");
    return okData(res, upd.data);
  });

  router.get("/admin/audit-logs", async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = 20;
    const rows = await supabaseAdmin.from("audit_logs").select("*").order("id", { ascending: false }).limit(5000);
    let list = rows.data ?? [];
    if (typeof req.query.action === "string" && req.query.action) {
      list = list.filter((x: Record<string, unknown>) => String(x.action) === req.query.action);
    }
    const fromQ = typeof req.query.from === "string" ? req.query.from : null;
    const toQ = typeof req.query.to === "string" ? req.query.to : null;
    if (fromQ) {
      list = list.filter((x: Record<string, unknown>) => String(x.created_at) >= fromQ);
    }
    if (toQ) {
      list = list.filter((x: Record<string, unknown>) => String(x.created_at) <= toQ);
    }
    const p = paginate(list, page, perPage);
    return res.json(p);
  });

  router.get("/admin/audit-logs/export", async (req, res) => {
    const rows = await supabaseAdmin.from("audit_logs").select("*").order("id", { ascending: false }).limit(10000);
    let list = rows.data ?? [];
    const fromQ = typeof req.query.from === "string" ? req.query.from : null;
    const toQ = typeof req.query.to === "string" ? req.query.to : null;
    if (fromQ) list = list.filter((x: Record<string, unknown>) => String(x.created_at) >= fromQ);
    if (toQ) list = list.filter((x: Record<string, unknown>) => String(x.created_at) <= toQ);
    const csv = [
      "id,admin_user_id,action,target_type,target_id,ip,created_at",
      ...list.map((x: Record<string, unknown>) =>
        [x.id, x.admin_user_id, x.action, x.target_type, x.target_id, x.ip, x.created_at]
          .map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`)
          .join(",")
      )
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=audit-logs.csv");
    return res.send(csv);
  });

  router.get("/admin/notification-templates", async (_req, res) => {
    const rows = await supabaseAdmin.from("notification_templates").select("*").order("id");
    return okData(res, rows.data ?? []);
  });

  router.patch("/admin/notification-templates/:template", async (req, res) => {
    const id = Number(req.params.template);
    const upd = await supabaseAdmin.from("notification_templates").update(req.body as Record<string, unknown>).eq("id", id).select("*").single();
    if (upd.error || !upd.data) return fail(res, 404, "Template not found.");
    return okData(res, upd.data);
  });

  router.patch("/admin/notification-toggles", async (req, res) => {
    const body = req.body as { email_notifications_enabled?: boolean; sms_notifications_enabled?: boolean };
    const upd = await supabaseAdmin
      .from("platform_general")
      .update({
        ...(body.email_notifications_enabled !== undefined ? { email_notifications_enabled: body.email_notifications_enabled } : {}),
        ...(body.sms_notifications_enabled !== undefined ? { sms_notifications_enabled: body.sms_notifications_enabled } : {})
      })
      .eq("id", 1)
      .select("*")
      .single();
    if (upd.error || !upd.data) return fail(res, 500, "Could not update toggles.");
    return res.json({ message: "Updated." });
  });

  router.get("/admin/integrations", async (_req, res) => {
    const row = await supabaseAdmin.from("platform_general").select("integrations").eq("id", 1).single();
    return okData(res, (row.data as { integrations: Record<string, unknown> }).integrations ?? {});
  });

  for (const key of ["stripe", "smtp", "sms", "google-calendar", "whatsapp"] as const) {
    router.patch(`/admin/integrations/${key}`, async (req, res) => {
      const row = await supabaseAdmin.from("platform_general").select("integrations").eq("id", 1).single();
      const integrations = ((row.data as { integrations: Record<string, unknown> }).integrations ?? {}) as Record<string, unknown>;
      const merged = { ...integrations, [key]: req.body };
      await supabaseAdmin.from("platform_general").update({ integrations: merged }).eq("id", 1);
      return okData(res, merged);
    });
  }

  router.get("/admin/webhooks", async (_req, res) => {
    const rows = await supabaseAdmin.from("admin_webhooks").select("*").order("id");
    return okData(res, rows.data ?? []);
  });

  router.post("/admin/webhooks", async (req, res) => {
    const ins = await supabaseAdmin.from("admin_webhooks").insert(req.body as Record<string, unknown>).select("*").single();
    if (ins.error || !ins.data) return fail(res, 422, "Could not create webhook.");
    return okData(res, ins.data, 201);
  });

  router.patch("/admin/webhooks/:webhook", async (req, res) => {
    const id = Number(req.params.webhook);
    const upd = await supabaseAdmin.from("admin_webhooks").update(req.body as Record<string, unknown>).eq("id", id).select("*").single();
    if (upd.error || !upd.data) return fail(res, 404, "Not found.");
    return okData(res, upd.data);
  });

  router.delete("/admin/webhooks/:webhook", async (req, res) => {
    await supabaseAdmin.from("admin_webhooks").delete().eq("id", Number(req.params.webhook));
    return res.json({ message: "Deleted." });
  });

  router.post("/admin/webhooks/:webhook/test", async (_req, res) => {
    return res.json({ message: "Test webhook queued." });
  });

  router.get("/admin/analytics/summary", async (_req, res) => {
    const [shops, users, bookings, payments] = await Promise.all([
      supabaseAdmin.from("shops").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("users").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("salon_bookings").select("id", { count: "exact", head: true }),
      supabaseAdmin.from("salon_payments").select("amount_cents,status")
    ]);
    const completedRevenue = (payments.data ?? [])
      .filter((p: { status: string }) => p.status === "completed")
      .reduce((a: number, b: { amount_cents: number }) => a + Number(b.amount_cents ?? 0), 0);
    return okData(res, {
      total_shops: shops.count ?? 0,
      total_users: users.count ?? 0,
      total_bookings: bookings.count ?? 0,
      total_revenue_cents_completed: completedRevenue
    });
  });

  router.get("/admin/permissions", async (_req, res) => {
    const row = await supabaseAdmin.from("platform_general").select("role_permissions").eq("id", 1).single();
    const overrides = (row.data as { role_permissions: Record<string, unknown> | null }).role_permissions ?? {};
    return okData(res, { matrix: overrides as Record<string, Record<string, boolean>>, overrides });
  });

  router.put("/admin/permissions", async (req, res) => {
    const parsed = z.object({ role_permissions: z.record(z.string(), z.any()) }).safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    await supabaseAdmin.from("platform_general").update({ role_permissions: parsed.data.role_permissions }).eq("id", 1);
    return okData(res, { role_permissions: parsed.data.role_permissions });
  });

  router.post("/admin/users/:user/impersonate", async (req, res) => {
    const targetId = req.params.user;
    const u = await supabaseAdmin.from("users").select("id,role").eq("id", targetId).maybeSingle();
    if (!u.data) return fail(res, 404, "User not found.");
    const target = u.data as { id: string; role: string };
    if (target.role === "super_admin") {
      return fail(res, 403, "Cannot impersonate another super admin.");
    }
    const access_token = signAccessToken({ sub: target.id, role: target.role });
    const refresh_token = issueRefreshToken();
    await supabaseAdmin.from("refresh_tokens").insert({
      user_id: target.id,
      token_hash: hashToken(refresh_token),
      expires_at: new Date(Date.now() + config.jwtRefreshTtlSeconds * 1000).toISOString()
    });
    return res.json({ access_token, refresh_token, expires_in: config.jwtAccessTtlSeconds });
  });

  router.delete("/admin/users/:user", async (req, res) => {
    await supabaseAdmin.from("users").delete().eq("id", req.params.user);
    return res.json({ message: "Deleted." });
  });

  router.get("/admin/billing/bkash", async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = 20;
    const rows = await supabaseAdmin.from("bkash_payments").select("*").order("id", { ascending: false }).limit(5000);
    let list = rows.data ?? [];
    if (typeof req.query.shop_id === "string") list = list.filter((x: Record<string, unknown>) => String(x.shop_id) === req.query.shop_id);
    if (typeof req.query.status === "string") list = list.filter((x: Record<string, unknown>) => String(x.status) === req.query.status);
    const fromQ = typeof req.query.from === "string" ? req.query.from : null;
    const toQ = typeof req.query.to === "string" ? req.query.to : null;
    if (fromQ) list = list.filter((x: Record<string, unknown>) => String(x.created_at) >= fromQ);
    if (toQ) list = list.filter((x: Record<string, unknown>) => String(x.created_at) <= toQ);
    return res.json(paginate(list, page, perPage));
  });

  router.get("/admin/billing/salon-payments", async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = 20;
    const rows = await supabaseAdmin.from("salon_payments").select("*").order("id", { ascending: false }).limit(5000);
    let list = rows.data ?? [];
    if (typeof req.query.shop_id === "string") list = list.filter((x: Record<string, unknown>) => String(x.shop_id) === req.query.shop_id);
    if (typeof req.query.status === "string") list = list.filter((x: Record<string, unknown>) => String(x.status) === req.query.status);
    const fromQ = typeof req.query.from === "string" ? req.query.from : null;
    const toQ = typeof req.query.to === "string" ? req.query.to : null;
    if (fromQ) list = list.filter((x: Record<string, unknown>) => String(x.created_at) >= fromQ);
    if (toQ) list = list.filter((x: Record<string, unknown>) => String(x.created_at) <= toQ);
    return res.json(paginate(list, page, perPage));
  });

  router.patch("/admin/billing/bkash/:payment/refund", async (req, res) => {
    const id = Number(req.params.payment);
    await supabaseAdmin.from("bkash_payments").update({ status: "refunded" }).eq("id", id);
    return res.json({ message: "Refunded." });
  });

  router.patch("/admin/billing/salon-payments/:salon_payment/refund", async (req, res) => {
    const id = Number(req.params.salon_payment);
    await supabaseAdmin.from("salon_payments").update({ status: "refunded" }).eq("id", id);
    return res.json({ message: "Refunded." });
  });

  router.get("/admin/billing/salon-payments/:salon_payment/invoice", async (req, res) => {
    const id = Number(req.params.salon_payment);
    const row = await supabaseAdmin.from("salon_payments").select("*").eq("id", id).maybeSingle();
    if (!row.data) return fail(res, 404, "Payment not found.");
    return okData(res, { invoice_number: `INV-${id}`, payment: row.data });
  });

  router.get("/system/shops", async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = 20;
    const shops = await supabaseAdmin.from("shops").select("*").order("id", { ascending: false }).limit(5000);
    const subs = await supabaseAdmin.from("subscriptions").select("*").limit(5000);
    const users = await supabaseAdmin.from("users").select("id,name,mobile,role,is_locked,created_at").limit(5000);
    const bks = await supabaseAdmin.from("bkash_payments").select("shop_id,amount_paisa,status,created_at").limit(10000);
    const subMap = new Map<number, Record<string, unknown>>();
    for (const s of subs.data ?? []) subMap.set((s as { shop_id: number }).shop_id, s as Record<string, unknown>);
    const userMap = new Map<string, Record<string, unknown>>();
    for (const u of users.data ?? []) userMap.set((u as { id: string }).id, u as Record<string, unknown>);
    const payByShop = new Map<number, { total: number; count: number; lastAt: string | null; lastAmount: number | null; lastStatus: string | null }>();
    for (const p of bks.data ?? []) {
      const row = p as { shop_id: number; amount_paisa: number; status: string; created_at: string };
      const cur = payByShop.get(row.shop_id) ?? { total: 0, count: 0, lastAt: null, lastAmount: null, lastStatus: null };
      cur.total += Number(row.amount_paisa ?? 0);
      cur.count += 1;
      if (!cur.lastAt || row.created_at > cur.lastAt) {
        cur.lastAt = row.created_at;
        cur.lastAmount = Number(row.amount_paisa ?? 0);
        cur.lastStatus = row.status;
      }
      payByShop.set(row.shop_id, cur);
    }
    let list: Record<string, unknown>[] = (shops.data ?? []).map((s) => {
      const shop = s as Record<string, unknown>;
      const owner = shop.owner_user_id ? userMap.get(String(shop.owner_user_id)) : null;
      const sub = subMap.get(Number(shop.id)) ?? null;
      const pay = payByShop.get(Number(shop.id)) ?? { total: 0, count: 0, lastAt: null, lastAmount: null, lastStatus: null };
      return {
        ...shop,
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              mobile: owner.mobile,
              role: owner.role,
              is_locked: owner.is_locked,
              created_at: owner.created_at
            }
          : null,
        subscription: sub
          ? {
              id: sub.id,
              status: sub.status,
              plan_key: sub.plan_key,
              active_from: sub.created_at,
              trial_ends_at: sub.trial_ends_at,
              current_period_end: sub.current_period_end
            }
          : null,
        payment_summary: {
          total_paid_paisa: pay.total,
          payments_count: pay.count,
          last_payment_at: pay.lastAt,
          last_payment_amount_paisa: pay.lastAmount,
          last_payment_status: pay.lastStatus
        }
      };
    });
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const s = req.query.search.toLowerCase();
      list = list.filter((x) => String((x as Record<string, unknown>).name ?? "").toLowerCase().includes(s) || String((x as Record<string, unknown>).slug ?? "").toLowerCase().includes(s));
    }
    if (typeof req.query.plan_key === "string" && req.query.plan_key) {
      list = list.filter((x) => String((x.subscription as Record<string, unknown> | null)?.plan_key ?? "") === req.query.plan_key);
    }
    const createdFrom = typeof req.query.created_from === "string" ? req.query.created_from : null;
    const createdTo = typeof req.query.created_to === "string" ? req.query.created_to : null;
    if (createdFrom) list = list.filter((x) => String((x as Record<string, unknown>).created_at) >= createdFrom);
    if (createdTo) list = list.filter((x) => String((x as Record<string, unknown>).created_at) <= createdTo);
    if (typeof req.query.filter === "string" && req.query.filter !== "all") {
      const f = req.query.filter;
      if (f === "locked") list = list.filter((x) => Boolean((x.owner as Record<string, unknown> | null)?.is_locked));
      if (f === "paid") list = list.filter((x) => Number((x.payment_summary as Record<string, unknown>).payments_count ?? 0) > 0);
      if (f === "unpaid") list = list.filter((x) => Number((x.payment_summary as Record<string, unknown>).payments_count ?? 0) === 0);
      if (f === "expired") {
        const nowIso = new Date().toISOString();
        list = list.filter((x) => {
          const sub = x.subscription as Record<string, unknown> | null;
          const end = sub?.current_period_end ? String(sub.current_period_end) : null;
          return Boolean(end && end < nowIso);
        });
      }
    }
    return res.json(paginate(list, page, perPage));
  });

  router.post("/system/shops", async (req, res) => {
    const ins = await supabaseAdmin.from("shops").insert(req.body as Record<string, unknown>).select("*").single();
    if (ins.error || !ins.data) return fail(res, 422, "Could not create shop.");
    const shopId = Number((ins.data as { id?: unknown }).id ?? NaN);
    if (Number.isFinite(shopId)) await seedDefaultServicesForShop(shopId);
    return okData(res, ins.data, 201);
  });

  router.patch("/system/shops/:id", async (req, res) => {
    const upd = await supabaseAdmin.from("shops").update(req.body as Record<string, unknown>).eq("id", Number(req.params.id)).select("*").single();
    if (upd.error || !upd.data) return fail(res, 404, "Shop not found.");
    return okData(res, upd.data);
  });

  router.delete("/system/shops/:id", async (req, res) => {
    await supabaseAdmin.from("shops").delete().eq("id", Number(req.params.id));
    return res.json({ message: "Deleted." });
  });

  router.get("/system/users", async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = 20;
    const rows = await supabaseAdmin.from("users").select("id,name,mobile,role,is_locked,created_at").order("created_at", { ascending: false }).limit(5000);
    let list: Record<string, unknown>[] = (rows.data ?? []).map((u: Record<string, unknown>) => ({ ...u, is_admin: u.role === "super_admin" || u.role === "shop_owner" }));
    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const s = req.query.search.toLowerCase();
      list = list.filter((x) => String((x as Record<string, unknown>).name ?? "").toLowerCase().includes(s) || String((x as Record<string, unknown>).mobile ?? "").toLowerCase().includes(s));
    }
    if (typeof req.query.role === "string" && req.query.role) list = list.filter((x) => String((x as Record<string, unknown>).role) === req.query.role);
    if (typeof req.query.status === "string") {
      if (req.query.status === "locked") list = list.filter((x) => Boolean((x as Record<string, unknown>).is_locked));
      if (req.query.status === "active") list = list.filter((x) => !Boolean((x as Record<string, unknown>).is_locked));
    }
    return res.json(paginate(list, page, perPage));
  });

  router.patch("/system/users/:user", async (req, res) => {
    const id = req.params.user;
    const upd = await supabaseAdmin.from("users").update(req.body as Record<string, unknown>).eq("id", id).select("id").maybeSingle();
    if (!upd.data) return fail(res, 404, "User not found.");
    return res.json({ message: "Updated." });
  });

  router.post("/system/users/:user/reset-password", async (req, res) => {
    const id = req.params.user;
    const parsed = z.object({ password: z.string().min(8) }).safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const hash = await bcrypt.hash(parsed.data.password, 10);
    const upd = await supabaseAdmin.from("users").update({ password_hash: hash }).eq("id", id).select("id").maybeSingle();
    if (!upd.data) return fail(res, 404, "User not found.");
    return res.json({ message: "Password reset." });
  });

  router.post("/system/subscriptions/:subscription/extend", async (req, res) => {
    const id = Number(req.params.subscription);
    const parsed = z.object({ days: z.number().int().min(1).max(3650) }).safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const cur = await supabaseAdmin.from("subscriptions").select("current_period_end").eq("id", id).maybeSingle();
    if (!cur.data) return fail(res, 404, "Subscription not found.");
    const end = new Date((cur.data as { current_period_end: string | null }).current_period_end ?? new Date().toISOString());
    end.setUTCDate(end.getUTCDate() + parsed.data.days);
    await supabaseAdmin.from("subscriptions").update({ current_period_end: end.toISOString() }).eq("id", id);
    return res.json({ message: "Extended." });
  });

  router.patch("/system/subscriptions/:subscription", async (req, res) => {
    const id = Number(req.params.subscription);
    const upd = await supabaseAdmin.from("subscriptions").update(req.body as Record<string, unknown>).eq("id", id).select("*").single();
    if (upd.error || !upd.data) return fail(res, 404, "Subscription not found.");
    return okData(res, upd.data);
  });

  router.get("/system/bkash-payments", async (req, res) => {
    const page = Math.max(1, Number(req.query.page ?? 1));
    const perPage = 20;
    const rows = await supabaseAdmin.from("bkash_payments").select("*").order("id", { ascending: false }).limit(5000);
    const p = paginate(rows.data ?? [], page, perPage);
    return res.json(p);
  });

  router.post("/system/bkash-payments", async (req, res) => {
    const schema = z.object({
      shop_id: z.number().int(),
      amount_paisa: z.number().int().positive(),
      trx_id: z.string().nullable().optional(),
      status: z.string().optional(),
      payer_mobile: z.string().nullable().optional(),
      note: z.string().nullable().optional()
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const ins = await supabaseAdmin
      .from("bkash_payments")
      .insert({
        shop_id: parsed.data.shop_id,
        amount_paisa: parsed.data.amount_paisa,
        trx_id: parsed.data.trx_id ?? null,
        status: parsed.data.status ?? "completed",
        payer_mobile: parsed.data.payer_mobile ?? null,
        note: parsed.data.note ?? null
      })
      .select("*")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create bKash payment.");
    return okData(res, ins.data, 201);
  });
}

