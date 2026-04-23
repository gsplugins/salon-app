import type { Request, Response, Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { fail, okData } from "../lib/http.js";
import { normalizeMobile } from "../lib/mobile.js";

type ShopRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  latitude: string | null;
  longitude: string | null;
  is_active: boolean;
  photos: string[] | null;
};

type ServiceRow = {
  id: number;
  shop_id: number;
  name: string;
  category: string | null;
  duration_minutes: number;
  buffer_after_minutes: number;
  price_cents: number | null;
  is_active: boolean;
  sort_order: number;
};

type StaffRow = {
  id: number;
  shop_id: number;
  user_id: string | null;
  name: string;
  bio: string | null;
  photo_url: string | null;
  specialties: unknown;
  is_active: boolean;
  sort_order: number;
};

function paginationMeta(page: number, perPage: number, total: number) {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  return {
    current_page: page,
    last_page: lastPage,
    per_page: perPage,
    total
  };
}

export function mountPublicRoutes(router: Router): void {
  router.get("/public/shops", async (req: Request, res: Response) => {
    const query = z.object({
      search: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(12)
    });
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const { search, page, per_page } = parsed.data;
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;

    let base = supabaseAdmin
      .from("shops")
      .select("id,name,slug,description,address,phone,photos,is_active", { count: "exact" })
      .eq("is_active", true)
      .order("id", { ascending: false })
      .range(from, to);

    if (search && search.trim()) {
      const s = search.trim();
      base = base.or(`name.ilike.%${s}%,slug.ilike.%${s}%,address.ilike.%${s}%`);
    }

    const result = await base;
    if (result.error) return fail(res, 500, "Could not load shops.");
    return res.json({
      data: result.data ?? [],
      ...paginationMeta(page, per_page, result.count ?? 0)
    });
  });

  router.get("/public/shops/:shopId", async (req: Request, res: Response) => {
    const shopId = Number(req.params.shopId);
    if (!Number.isFinite(shopId)) return fail(res, 422, "Invalid shop id.");

    const shopRes = await supabaseAdmin.from("shops").select("*").eq("id", shopId).eq("is_active", true).maybeSingle();
    const shop = shopRes.data as ShopRow | null;
    if (!shop) return fail(res, 404, "Shop not found.");

    const servicesRes = await supabaseAdmin
      .from("salon_services")
      .select("id,name,category,duration_minutes,buffer_after_minutes,price_cents")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order");

    const staffRes = await supabaseAdmin
      .from("salon_staff")
      .select("id,name,bio,photo_url,specialties")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order");

    return okData(res, {
      shop: {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        description: shop.description,
        phone: shop.phone,
        email: shop.email,
        address: shop.address,
        latitude: shop.latitude,
        longitude: shop.longitude,
        photos: shop.photos ?? [],
        parent_shop_id: null
      },
      services: servicesRes.data ?? [],
      staff: staffRes.data ?? [],
      reviews_summary: { count: 0, avg_rating: null },
      reviews: []
    });
  });

  router.get("/public/barbers/:staffId", async (req: Request, res: Response) => {
    const staffId = Number(req.params.staffId);
    if (!Number.isFinite(staffId)) return fail(res, 422, "Invalid staff id.");

    const staffRes = await supabaseAdmin.from("salon_staff").select("*").eq("id", staffId).maybeSingle();
    const staff = staffRes.data as StaffRow | null;
    if (!staff || !staff.is_active) return fail(res, 404, "Barber not found.");

    const shopRes = await supabaseAdmin.from("shops").select("id,name,slug").eq("id", staff.shop_id).maybeSingle();
    return okData(res, {
      id: staff.id,
      name: staff.name,
      bio: staff.bio,
      photo_url: staff.photo_url,
      specialties: staff.specialties,
      weekly_schedule: {},
      shop: shopRes.data ?? null,
      reviews_summary: { count: 0, avg_rating: null },
      recent_reviews: []
    });
  });

  router.get("/shops/:slug/meta", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const shopRes = await supabaseAdmin
      .from("shops")
      .select("id,name,slug,description")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");
    return okData(res, shopRes.data);
  });

  router.get("/shops/:slug/services", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const shopRes = await supabaseAdmin.from("shops").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");
    const rows = await supabaseAdmin
      .from("salon_services")
      .select("id,name,duration_minutes,price_cents,category,buffer_after_minutes,is_active,sort_order")
      .eq("shop_id", shopRes.data.id)
      .eq("is_active", true)
      .order("sort_order");
    return okData(res, rows.data ?? []);
  });

  router.get("/shops/:slug/staff", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const serviceIdRaw = req.query.service_id;
    const serviceId = serviceIdRaw != null ? Number(serviceIdRaw) : null;
    const shopRes = await supabaseAdmin.from("shops").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");

    let staffQuery = supabaseAdmin
      .from("salon_staff")
      .select("id,name,is_active,sort_order")
      .eq("shop_id", shopRes.data.id)
      .eq("is_active", true)
      .order("sort_order");

    if (serviceId != null && Number.isFinite(serviceId)) {
      const mapRows = await supabaseAdmin
        .from("salon_staff_services")
        .select("staff_id")
        .eq("service_id", serviceId)
        .eq("shop_id", shopRes.data.id);
      const staffIds = (mapRows.data ?? []).map((x: { staff_id: number }) => x.staff_id);
      if (staffIds.length === 0) return okData(res, [{ id: null, name: "Any available staff" }]);
      staffQuery = staffQuery.in("id", staffIds);
    }

    const rows = await staffQuery;
    const data = (rows.data ?? []).map((r: { id: number; name: string }) => ({ id: r.id, name: r.name }));
    return okData(res, [{ id: null, name: "Any available staff" }, ...data]);
  });

  router.get("/public/shops/:shopId/queue", async (req: Request, res: Response) => {
    const shopId = Number(req.params.shopId);
    if (!Number.isFinite(shopId)) return fail(res, 422, "Invalid shop id.");
    const rows = await supabaseAdmin
      .from("queue_entries")
      .select("id,position,status,customer_name,estimated_wait_minutes,staff_id,join_time,salon_staff(name)")
      .eq("shop_id", shopId)
      .in("status", ["waiting", "in_progress"])
      .order("position");
    const data = (rows.data ?? []).map(
      (row: {
        id: number;
        position: number;
        status: string;
        customer_name: string;
        estimated_wait_minutes: number | null;
        staff_id: number | null;
        join_time: string | null;
        salon_staff: { name: string }[] | null;
      }) => ({
        id: row.id,
        position: row.position,
        status: row.status,
        customer_name: row.customer_name,
        estimated_wait_minutes: row.estimated_wait_minutes,
        staff: row.staff_id ? { id: row.staff_id, name: row.salon_staff?.[0]?.name ?? "Staff" } : null,
        join_time: row.join_time
      })
    );
    return okData(res, data);
  });

  router.post("/public/shops/:shopId/queue/join", async (req: Request, res: Response) => {
    const shopId = Number(req.params.shopId);
    if (!Number.isFinite(shopId)) return fail(res, 422, "Invalid shop id.");
    const body = z.object({
      customer_name: z.string().min(1).max(120),
      customer_mobile: z.string().optional().nullable()
    });
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const maxRes = await supabaseAdmin
      .from("queue_entries")
      .select("position")
      .eq("shop_id", shopId)
      .in("status", ["waiting", "in_progress"])
      .order("position", { ascending: false })
      .limit(1);
    const nextPos = (maxRes.data?.[0]?.position ?? 0) + 1;

    const inserted = await supabaseAdmin
      .from("queue_entries")
      .insert({
        shop_id: shopId,
        customer_name: parsed.data.customer_name,
        customer_mobile: parsed.data.customer_mobile ? normalizeMobile(parsed.data.customer_mobile) : null,
        position: nextPos,
        status: "waiting",
        join_time: new Date().toISOString()
      })
      .select("id,position")
      .single();
    if (inserted.error || !inserted.data) return fail(res, 500, "Could not join queue.");
    return okData(res, inserted.data, 201);
  });

  router.get("/shops/:slug/availability", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const date = String(req.query.date ?? "");
    if (!date) return fail(res, 422, "date is required.");
    const shopRes = await supabaseAdmin.from("shops").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");
    // Placeholder slot generation; replace with full scheduling rules in next phase.
    return okData(res, [`${date}T10:00:00.000Z`, `${date}T11:00:00.000Z`, `${date}T12:00:00.000Z`]);
  });

  router.post("/shops/:slug/bookings", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const shopRes = await supabaseAdmin.from("shops").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");
    const body = z.object({
      customer_name: z.string().min(1).max(120),
      customer_mobile: z.string().min(8).max(32),
      salon_service_id: z.number().int().positive(),
      salon_staff_id: z.number().int().positive().nullable().optional(),
      starts_at: z.string().min(10),
      notes: z.string().max(2000).nullable().optional()
    });
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const serviceRes = await supabaseAdmin
      .from("salon_services")
      .select("id,name,duration_minutes,price_cents")
      .eq("id", parsed.data.salon_service_id)
      .eq("shop_id", shopRes.data.id)
      .maybeSingle();
    if (!serviceRes.data) return fail(res, 422, "Invalid service.");

    let staff = null as { id: number; name: string } | null;
    if (parsed.data.salon_staff_id != null) {
      const staffRes = await supabaseAdmin
        .from("salon_staff")
        .select("id,name")
        .eq("id", parsed.data.salon_staff_id)
        .eq("shop_id", shopRes.data.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!staffRes.data) return fail(res, 422, "Invalid staff.");
      staff = staffRes.data;
    } else {
      const fallbackStaff = await supabaseAdmin
        .from("salon_staff")
        .select("id,name")
        .eq("shop_id", shopRes.data.id)
        .eq("is_active", true)
        .order("sort_order")
        .limit(1)
        .maybeSingle();
      staff = fallbackStaff.data ?? null;
    }
    if (!staff) return fail(res, 422, "No available staff.");

    const startsAt = new Date(parsed.data.starts_at);
    const duration = serviceRes.data.duration_minutes ?? 30;
    const endsAt = new Date(startsAt.getTime() + duration * 60_000);
    const ins = await supabaseAdmin
      .from("salon_bookings")
      .insert({
        shop_id: shopRes.data.id,
        salon_service_id: serviceRes.data.id,
        salon_staff_id: staff.id,
        customer_name: parsed.data.customer_name,
        customer_mobile: normalizeMobile(parsed.data.customer_mobile),
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "confirmed",
        source: "web",
        notes: parsed.data.notes ?? null
      })
      .select("id,customer_name,customer_mobile,starts_at,ends_at,status,source,notes")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create booking.");

    return okData(
      res,
      {
        ...ins.data,
        shop: null,
        service: {
          id: serviceRes.data.id,
          name: serviceRes.data.name,
          duration_minutes: serviceRes.data.duration_minutes,
          price_cents: serviceRes.data.price_cents ?? null
        },
        staff
      },
      201
    );
  });
}
