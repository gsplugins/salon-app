import type { Request, Response, Router } from "express";
import { z } from "zod";
import { supabaseAdmin } from "../lib/supabase.js";
import { fail, okData } from "../lib/http.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { normalizeMobile } from "../lib/mobile.js";

function optionalCustomerUserId(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  try {
    const p = verifyAccessToken(auth.slice(7).trim());
    if (p.role !== "customer") return null;
    return p.sub;
  } catch {
    return null;
  }
}

function bookingAdvancePercentFromSettings(settings: unknown): number {
  const s = (settings && typeof settings === "object" ? settings : {}) as Record<string, unknown>;
  const raw = s.booking_advance_percent;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

function parseServiceIdsFromQuery(req: Request): { ids: number[] | null; hasFilter: boolean } {
  const rawIds = req.query.service_ids;
  const rawId = req.query.service_id;
  const hasFilter = rawIds !== undefined || rawId !== undefined;
  const parts: string[] = [];
  if (typeof rawIds === "string") parts.push(...rawIds.split(","));
  else if (Array.isArray(rawIds)) for (const x of rawIds) parts.push(...String(x).split(","));
  if (typeof rawId === "string") parts.push(rawId);
  else if (rawId != null && parts.length === 0) parts.push(String(rawId));
  const nums = parts.map((p) => Number(String(p).trim())).filter((n) => Number.isFinite(n) && n > 0);
  const uniq = [...new Set(nums)];
  if (!hasFilter) return { ids: null, hasFilter: false };
  return { ids: uniq.length ? uniq : [], hasFilter: true };
}

async function staffIdsWhoCanDoAllServices(shopId: number, serviceIds: number[]): Promise<number[]> {
  if (serviceIds.length === 0) return [];
  const mapRows = await supabaseAdmin
    .from("salon_staff_services")
    .select("staff_id,service_id")
    .eq("shop_id", shopId)
    .in("service_id", serviceIds);
  const byStaff = new Map<number, Set<number>>();
  for (const row of mapRows.data ?? []) {
    const r = row as { staff_id: number; service_id: number };
    let set = byStaff.get(r.staff_id);
    if (!set) {
      set = new Set();
      byStaff.set(r.staff_id, set);
    }
    set.add(r.service_id);
  }
  const need = new Set(serviceIds);
  const out: number[] = [];
  for (const [staffId, svcs] of byStaff) {
    if ([...need].every((id) => svcs.has(id))) out.push(staffId);
  }
  return out;
}

function toDayKeyFromDateYmd(dateYmd: string): "sun" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" {
  const d = new Date(`${dateYmd}T00:00:00.000Z`);
  const keys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
  return keys[d.getUTCDay()] ?? "mon";
}

function parseHmMinutes(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function combineDateAndMinutesUtc(dateYmd: string, mins: number): Date {
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return new Date(`${dateYmd}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00.000Z`);
}

function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && aEnd > bStart;
}

type TimeRange = { start: Date; end: Date };

function hasAnyOverlap(start: Date, end: Date, ranges: TimeRange[]): boolean {
  return ranges.some((r) => rangesOverlap(start, end, r.start, r.end));
}

async function isStaffFreeAt(shopId: number, staffId: number, startsAt: Date, endsAt: Date): Promise<boolean> {
  const blockedConflict = await supabaseAdmin
    .from("salon_blocked_slots")
    .select("id")
    .eq("shop_id", shopId)
    .or(`salon_staff_id.is.null,salon_staff_id.eq.${staffId}`)
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())
    .limit(1)
    .maybeSingle();
  if (blockedConflict.data) return false;

  const bookingConflict = await supabaseAdmin
    .from("salon_bookings")
    .select("id")
    .eq("shop_id", shopId)
    .eq("salon_staff_id", staffId)
    .eq("status", "confirmed")
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", startsAt.toISOString())
    .limit(1)
    .maybeSingle();
  if (bookingConflict.data) return false;

  return true;
}

async function notifyStaffAndManagersAboutPendingBooking(args: {
  shopId: number;
  assignedStaffId: number;
  bookingId: number;
  customerName: string;
  startsAtIso: string;
}): Promise<void> {
  const { shopId, assignedStaffId, bookingId, customerName, startsAtIso } = args;
  try {
    const recipients = new Set<number>([assignedStaffId]);

    const managerByRole = await supabaseAdmin
      .from("salon_staff")
      .select("id")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .eq("staff_role", "manager");
    for (const row of (managerByRole.data ?? []) as { id: number }[]) recipients.add(row.id);

    const managerMembers = await supabaseAdmin
      .from("shop_members")
      .select("user_id")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .eq("role", "manager");
    const managerUserIds = (managerMembers.data ?? [])
      .map((r: { user_id: string | null }) => r.user_id)
      .filter((x): x is string => Boolean(x));
    if (managerUserIds.length) {
      const managerStaffRows = await supabaseAdmin
        .from("salon_staff")
        .select("id")
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .in("user_id", managerUserIds);
      for (const row of (managerStaffRows.data ?? []) as { id: number }[]) recipients.add(row.id);
    }

    const rows = [...recipients].map((sid) => ({
      salon_staff_id: sid,
      type: "booking_pending",
      title: "New pending booking",
      body: `${customerName} requested a booking for ${new Date(startsAtIso).toLocaleString()}.`,
      metadata: { booking_id: bookingId, shop_id: shopId, status: "pending" },
      is_read: false
    }));
    if (rows.length) await supabaseAdmin.from("staff_notifications").insert(rows);
  } catch {
    // Do not fail booking creation if notification fan-out fails.
  }
}

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
  settings: Record<string, unknown> | null;
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
  position_title?: string | null;
  staff_role?: string | null;
  experience_years?: number | null;
  address?: string | null;
  work_mobile?: string | null;
  weekly_schedule?: unknown;
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
      division: z.string().optional(),
      district: z.string().optional(),
      city: z.string().optional(),
      page: z.coerce.number().int().min(1).default(1),
      per_page: z.coerce.number().int().min(1).max(100).default(12)
    });
    const parsed = query.safeParse(req.query);
    if (!parsed.success) return fail(res, 422, "Validation failed.");

    const { search, division, district, city, page, per_page } = parsed.data;
    const from = (page - 1) * per_page;
    const to = from + per_page - 1;

    let base = supabaseAdmin
      .from("shops")
      .select("id,name,slug,description,address,phone,latitude,longitude,photos,settings,is_active", { count: "exact" })
      .eq("is_active", true)
      .order("id", { ascending: false })
      .range(from, to);

    if (search && search.trim()) {
      const s = search.trim();
      base = base.or(`name.ilike.%${s}%,slug.ilike.%${s}%,address.ilike.%${s}%`);
    }
    if (division && division.trim()) {
      base = base.contains("settings", { division: division.trim() });
    }
    if (district && district.trim()) {
      base = base.contains("settings", { district: district.trim() });
    }
    if (city && city.trim()) {
      base = base.contains("settings", { city: city.trim() });
    }

    const result = await base;
    if (result.error) return fail(res, 500, "Could not load shops.");
    const rows = ((result.data ?? []) as ShopRow[]).map((shop) => {
      const st = (shop.settings ?? {}) as Record<string, unknown>;
      return {
        id: shop.id,
        name: shop.name,
        slug: shop.slug,
        description: shop.description,
        address: shop.address,
        phone: shop.phone,
        latitude: shop.latitude,
        longitude: shop.longitude,
        photos: shop.photos ?? [],
        logo_url: typeof st.logo_url === "string" ? st.logo_url : null,
        division: typeof st.division === "string" ? st.division : null,
        district: typeof st.district === "string" ? st.district : null,
        city: typeof st.city === "string" ? st.city : null
      };
    });
    return res.json({
      data: rows,
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
      .select(
        "id,name,category,description,duration_minutes,buffer_after_minutes,price_cents,audience,aftercare,requires_patch_test,consultation_first,min_notice_hours,online_bookable,deposit_cents"
      )
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .eq("online_bookable", true)
      .order("sort_order");

    const staffRes = await supabaseAdmin
      .from("salon_staff")
      .select("id,name,bio,photo_url,specialties")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .order("sort_order");

    const reviewsRes = await supabaseAdmin
      .from("salon_reviews")
      .select("id,rating,comment,created_at,salon_staff(name),customer_user_id,salon_booking_id")
      .eq("shop_id", shopId)
      .order("created_at", { ascending: false })
      .limit(200);
    const bookingStatsRes = await supabaseAdmin
      .from("salon_bookings")
      .select("status,customer_mobile")
      .eq("shop_id", shopId)
      .limit(5000);
    const reviewsRaw = (reviewsRes.data ?? []) as {
      id: number;
      rating: number;
      comment: string | null;
      created_at: string | null;
      salon_staff: { name: string }[] | null;
      customer_user_id: string | null;
      salon_booking_id: number | null;
    }[];
    const userIds = [...new Set(reviewsRaw.map((r) => r.customer_user_id).filter((x): x is string => Boolean(x)))];
    const bookingIds = [...new Set(reviewsRaw.map((r) => r.salon_booking_id).filter((x): x is number => Number.isFinite(x)))];
    const [usersRes, bookingsRes] = await Promise.all([
      userIds.length
        ? supabaseAdmin.from("users").select("id,name,photo_url").in("id", userIds)
        : Promise.resolve({ data: [] as { id: string; name: string; photo_url: string | null }[] }),
      bookingIds.length
        ? supabaseAdmin.from("salon_bookings").select("id,customer_name").in("id", bookingIds)
        : Promise.resolve({ data: [] as { id: number; customer_name: string }[] }),
    ]);
    const userById = new Map<string, { name: string; photo_url: string | null }>();
    for (const u of (usersRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]) {
      userById.set(u.id, { name: u.name, photo_url: u.photo_url ?? null });
    }
    const bookingNameById = new Map<number, string>();
    for (const b of (bookingsRes.data ?? []) as { id: number; customer_name: string }[]) bookingNameById.set(b.id, b.customer_name);
    const reviewCount = reviewsRaw.length;
    const avgRating = reviewCount
      ? Math.round((reviewsRaw.reduce((sum, r) => sum + Number(r.rating), 0) / reviewCount) * 10) / 10
      : null;
    const statsRows = (bookingStatsRes.data ?? []) as { status: string; customer_mobile: string | null }[];
    const byStatus: Record<string, number> = {};
    const uniqueCustomers = new Set<string>();
    for (const row of statsRows) {
      const status = String(row.status ?? "").trim().toLowerCase() || "unknown";
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      if (row.customer_mobile) uniqueCustomers.add(row.customer_mobile);
    }

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
        logo_url: typeof (shop.settings ?? {}).logo_url === "string" ? String((shop.settings ?? {}).logo_url) : null,
        division: typeof (shop.settings ?? {}).division === "string" ? String((shop.settings ?? {}).division) : null,
        district: typeof (shop.settings ?? {}).district === "string" ? String((shop.settings ?? {}).district) : null,
        city: typeof (shop.settings ?? {}).city === "string" ? String((shop.settings ?? {}).city) : null,
        parent_shop_id: null
      },
      offers: Array.isArray((shop.settings ?? {}).offers)
        ? ((shop.settings ?? {}).offers as unknown[])
            .map((row) => {
              if (!row || typeof row !== "object") return null;
              const o = row as Record<string, unknown>;
              const title = typeof o.title === "string" ? o.title.trim() : "";
              if (!title) return null;
              return {
                title,
                description: typeof o.description === "string" ? o.description : null,
                discount_text: typeof o.discount_text === "string" ? o.discount_text : null,
                valid_until: typeof o.valid_until === "string" ? o.valid_until : null
              };
            })
            .filter(Boolean)
        : [],
      services: servicesRes.data ?? [],
      staff: staffRes.data ?? [],
      booking_stats: {
        pending: byStatus.pending ?? 0,
        confirmed: byStatus.confirmed ?? 0,
        cancelled: byStatus.cancelled ?? 0,
        completed: byStatus.completed ?? 0,
        total_customers: uniqueCustomers.size
      },
      reviews_summary: { count: reviewCount, avg_rating: avgRating },
      reviews: reviewsRaw.map((r) => ({
        id: r.id,
        rating: Number(r.rating),
        comment: r.comment ?? null,
        created_at: r.created_at ?? null,
        staff_name: r.salon_staff?.[0]?.name ?? null,
        customer_name: r.customer_user_id
          ? (userById.get(r.customer_user_id)?.name ?? null) ?? (r.salon_booking_id ? bookingNameById.get(r.salon_booking_id) : null) ?? "Customer"
          : (r.salon_booking_id ? bookingNameById.get(r.salon_booking_id) : null) ?? "Customer",
        customer_photo_url: r.customer_user_id ? (userById.get(r.customer_user_id)?.photo_url ?? null) : null
      }))
    });
  });

  router.get("/public/barbers/:staffId", async (req: Request, res: Response) => {
    const staffId = Number(req.params.staffId);
    if (!Number.isFinite(staffId)) return fail(res, 422, "Invalid staff id.");

    const staffRes = await supabaseAdmin.from("salon_staff").select("*").eq("id", staffId).maybeSingle();
    const staff = staffRes.data as StaffRow | null;
    if (!staff || !staff.is_active) return fail(res, 404, "Barber not found.");

    const shopRes = await supabaseAdmin.from("shops").select("id,name,slug").eq("id", staff.shop_id).maybeSingle();
    const reviewsRes = await supabaseAdmin
      .from("salon_reviews")
      .select("id,rating,comment,created_at,customer_user_id,salon_booking_id")
      .eq("salon_staff_id", staff.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const staffServicesRes = await supabaseAdmin
      .from("salon_staff_services")
      .select("service_id,salon_services(id,name,duration_minutes,price_cents)")
      .eq("staff_id", staff.id)
      .eq("shop_id", staff.shop_id);
    const completedBookingsRes = await supabaseAdmin
      .from("salon_bookings")
      .select("id", { count: "exact", head: true })
      .eq("salon_staff_id", staff.id)
      .eq("shop_id", staff.shop_id)
      .eq("status", "completed");
    const reviews = (reviewsRes.data ?? []) as {
      id: number;
      rating: number;
      comment: string | null;
      created_at: string | null;
      customer_user_id: string | null;
      salon_booking_id: number | null;
    }[];
    const reviewUserIds = [...new Set(reviews.map((r) => r.customer_user_id).filter((x): x is string => Boolean(x)))];
    const reviewBookingIds = [...new Set(reviews.map((r) => r.salon_booking_id).filter((x): x is number => Number.isFinite(x)))];
    const [reviewUsersRes, reviewBookingsRes] = await Promise.all([
      reviewUserIds.length
        ? supabaseAdmin.from("users").select("id,name,photo_url").in("id", reviewUserIds)
        : Promise.resolve({ data: [] as { id: string; name: string; photo_url: string | null }[] }),
      reviewBookingIds.length
        ? supabaseAdmin.from("salon_bookings").select("id,customer_name").in("id", reviewBookingIds)
        : Promise.resolve({ data: [] as { id: number; customer_name: string }[] })
    ]);
    const reviewUserById = new Map<string, { name: string; photo_url: string | null }>();
    for (const user of (reviewUsersRes.data ?? []) as { id: string; name: string; photo_url: string | null }[]) {
      reviewUserById.set(user.id, { name: user.name, photo_url: user.photo_url ?? null });
    }
    const reviewBookingNameById = new Map<number, string>();
    for (const booking of (reviewBookingsRes.data ?? []) as { id: number; customer_name: string }[]) {
      reviewBookingNameById.set(booking.id, booking.customer_name);
    }
    const services = (staffServicesRes.data ?? [])
      .map((row: { salon_services?: { id: number; name: string; duration_minutes: number; price_cents: number | null } | { id: number; name: string; duration_minutes: number; price_cents: number | null }[] | null }) => {
        if (Array.isArray(row.salon_services)) return row.salon_services[0] ?? null;
        return row.salon_services ?? null;
      })
      .filter(Boolean);
    const count = reviews.length;
    const avg = count ? Math.round((reviews.reduce((a, b) => a + Number(b.rating), 0) / count) * 10) / 10 : null;
    const completedCount = completedBookingsRes.count ?? 0;
    return okData(res, {
      id: staff.id,
      name: staff.name,
      bio: staff.bio,
      photo_url: staff.photo_url,
      specialties: staff.specialties,
      position_title: staff.position_title ?? null,
      staff_role: staff.staff_role ?? null,
      experience_years: staff.experience_years ?? null,
      address: staff.address ?? null,
      work_mobile: staff.work_mobile ?? null,
      weekly_schedule: {},
      shop: shopRes.data ?? null,
      services,
      stats: {
        completed_bookings: completedCount
      },
      reviews_summary: { count, avg_rating: avg },
      recent_reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        created_at: review.created_at,
        customer_name: review.customer_user_id
          ? (reviewUserById.get(review.customer_user_id)?.name ?? null) ??
            (review.salon_booking_id ? reviewBookingNameById.get(review.salon_booking_id) : null) ??
            "Customer"
          : (review.salon_booking_id ? reviewBookingNameById.get(review.salon_booking_id) : null) ?? "Customer",
        customer_photo_url: review.customer_user_id ? (reviewUserById.get(review.customer_user_id)?.photo_url ?? null) : null
      }))
    });
  });

  router.get("/shops/:slug/meta", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const shopRes = await supabaseAdmin
      .from("shops")
      .select("id,name,slug,description,settings")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");
    const row = shopRes.data as {
      id: number;
      name: string;
      slug: string;
      description: string | null;
      settings: unknown;
    };
    const pct = bookingAdvancePercentFromSettings(row.settings);
    return okData(res, {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      booking_advance_percent: pct
    });
  });

  router.get("/shops/:slug/services", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const shopRes = await supabaseAdmin.from("shops").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");
    const rows = await supabaseAdmin
      .from("salon_services")
      .select(
        "id,name,duration_minutes,price_cents,category,buffer_after_minutes,is_active,sort_order,description,audience,aftercare,requires_patch_test,consultation_first,min_notice_hours,online_bookable,deposit_cents"
      )
      .eq("shop_id", shopRes.data.id)
      .eq("is_active", true)
      .eq("online_bookable", true)
      .order("sort_order");
    return okData(res, rows.data ?? []);
  });

  router.get("/shops/:slug/staff", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const { ids: serviceIds, hasFilter } = parseServiceIdsFromQuery(req);
    const shopRes = await supabaseAdmin.from("shops").select("id").eq("slug", slug).eq("is_active", true).maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");

    let staffQuery = supabaseAdmin
      .from("salon_staff")
      .select("id,name,is_active,sort_order")
      .eq("shop_id", shopRes.data.id)
      .eq("is_active", true)
      .order("sort_order");

    if (hasFilter) {
      if (!serviceIds?.length) return fail(res, 422, "Invalid service_ids.");
      const staffIds = await staffIdsWhoCanDoAllServices(shopRes.data.id, serviceIds);
      if (staffIds.length === 0) return okData(res, []);
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
    const shopRes = await supabaseAdmin
      .from("shops")
      .select("id,settings")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");
    const { ids: serviceIds, hasFilter } = parseServiceIdsFromQuery(req);
    if (hasFilter && (!serviceIds || serviceIds.length === 0)) return fail(res, 422, "Invalid service_ids.");

    if (!serviceIds || serviceIds.length === 0) return okData(res, []);
    const shopId = (shopRes.data as { id: number }).id;
    const settings = ((shopRes.data as { settings: unknown }).settings ?? {}) as Record<string, unknown>;

    const servicesRes = await supabaseAdmin
      .from("salon_services")
      .select("id,duration_minutes,buffer_after_minutes,min_notice_hours,online_bookable,is_active")
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .eq("online_bookable", true)
      .in("id", serviceIds);
    const selectedServices = (servicesRes.data ?? []) as {
      id: number;
      duration_minutes: number;
      buffer_after_minutes: number | null;
      min_notice_hours: number | null;
      online_bookable: boolean | null;
      is_active: boolean | null;
    }[];
    if (selectedServices.length !== serviceIds.length) return fail(res, 422, "Invalid service selection.");
    const requiredDurationMin = Math.max(
      15,
      selectedServices.reduce((sum, s) => sum + (s.duration_minutes ?? 30) + (s.buffer_after_minutes ?? 0), 0)
    );

    const capableStaff = await staffIdsWhoCanDoAllServices(shopId, serviceIds);
    if (capableStaff.length === 0) return okData(res, []);

    const requestedStaffIdRaw = req.query.staff_id;
    const requestedStaffId = requestedStaffIdRaw != null ? Number(requestedStaffIdRaw) : null;
    let targetStaffIds = capableStaff;
    if (requestedStaffId != null && Number.isFinite(requestedStaffId)) {
      if (!capableStaff.includes(requestedStaffId)) return okData(res, []);
      targetStaffIds = [requestedStaffId];
    }

    const holidays = Array.isArray(settings.holidays) ? (settings.holidays as unknown[]) : [];
    if (
      holidays.some((h) => {
        const o = (h && typeof h === "object" ? h : {}) as Record<string, unknown>;
        return String(o.date ?? "") === date;
      })
    ) {
      return okData(res, []);
    }

    const dayKey = toDayKeyFromDateYmd(date);
    const bh = (settings.business_hours && typeof settings.business_hours === "object"
      ? settings.business_hours
      : {}) as Record<string, unknown>;
    const day = (bh[dayKey] && typeof bh[dayKey] === "object" ? bh[dayKey] : {}) as Record<string, unknown>;
    if (day.closed === true) return okData(res, []);
    const openMins = parseHmMinutes(typeof day.open === "string" ? day.open.slice(0, 5) : "09:00");
    const closeMins = parseHmMinutes(typeof day.close === "string" ? day.close.slice(0, 5) : "18:00");
    if (openMins == null || closeMins == null || closeMins <= openMins) return okData(res, []);

    const dayStart = combineDateAndMinutesUtc(date, openMins);
    const dayEnd = combineDateAndMinutesUtc(date, closeMins);
    const minLeadHoursRaw = settings.min_lead_time_hours;
    const minLeadHours = typeof minLeadHoursRaw === "number" ? minLeadHoursRaw : Number(minLeadHoursRaw ?? 0);
    const shopLeadCutoff =
      Number.isFinite(minLeadHours) && minLeadHours > 0 ? new Date(Date.now() + minLeadHours * 3600_000) : new Date(0);
    const serviceNoticeMs = Math.max(
      0,
      ...selectedServices.map((s) => Math.max(0, Number(s.min_notice_hours ?? 0)) * 3600_000)
    );
    const leadCutoff = new Date(Math.max(shopLeadCutoff.getTime(), Date.now() + serviceNoticeMs));

    const blockedRes = await supabaseAdmin
      .from("salon_blocked_slots")
      .select("salon_staff_id,starts_at,ends_at")
      .eq("shop_id", shopId)
      .or(`salon_staff_id.is.null,salon_staff_id.in.(${targetStaffIds.join(",")})`)
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString());
    const bookingRes = await supabaseAdmin
      .from("salon_bookings")
      .select("salon_staff_id,starts_at,ends_at,status")
      .eq("shop_id", shopId)
      .in("salon_staff_id", targetStaffIds)
      .eq("status", "confirmed")
      .lt("starts_at", dayEnd.toISOString())
      .gt("ends_at", dayStart.toISOString());

    const shopWideBlocks: TimeRange[] = [];
    const staffBusy = new Map<number, TimeRange[]>();
    for (const row of (blockedRes.data ?? []) as { salon_staff_id: number | null; starts_at: string; ends_at: string }[]) {
      const range = { start: new Date(row.starts_at), end: new Date(row.ends_at) };
      if (row.salon_staff_id == null) {
        shopWideBlocks.push(range);
      } else {
        const arr = staffBusy.get(row.salon_staff_id) ?? [];
        arr.push(range);
        staffBusy.set(row.salon_staff_id, arr);
      }
    }
    for (const row of (bookingRes.data ?? []) as { salon_staff_id: number; starts_at: string; ends_at: string }[]) {
      const arr = staffBusy.get(row.salon_staff_id) ?? [];
      arr.push({ start: new Date(row.starts_at), end: new Date(row.ends_at) });
      staffBusy.set(row.salon_staff_id, arr);
    }

    const stepMin = 15;
    const out: string[] = [];
    for (
      let cursor = new Date(dayStart.getTime());
      cursor.getTime() + requiredDurationMin * 60_000 <= dayEnd.getTime();
      cursor = new Date(cursor.getTime() + stepMin * 60_000)
    ) {
      const slotStart = new Date(cursor.getTime());
      const slotEnd = new Date(cursor.getTime() + requiredDurationMin * 60_000);
      if (slotStart < leadCutoff) continue;
      if (hasAnyOverlap(slotStart, slotEnd, shopWideBlocks)) continue;
      const isAvailable = targetStaffIds.some((sid) => !hasAnyOverlap(slotStart, slotEnd, staffBusy.get(sid) ?? []));
      if (isAvailable) out.push(slotStart.toISOString());
    }
    return okData(res, out);
  });

  router.post("/shops/:slug/bookings", async (req: Request, res: Response) => {
    const slug = String(req.params.slug ?? "").trim();
    const shopRes = await supabaseAdmin
      .from("shops")
      .select("id,settings")
      .eq("slug", slug)
      .eq("is_active", true)
      .maybeSingle();
    if (!shopRes.data) return fail(res, 404, "Shop not found.");
    const shopId = (shopRes.data as { id: number }).id;
    const shopSettings = (shopRes.data as { settings: unknown }).settings;

    const body = z.object({
      customer_name: z.string().min(1).max(120),
      customer_mobile: z.string().min(8).max(32),
      salon_service_id: z.number().int().positive().optional(),
      salon_service_ids: z.array(z.number().int().positive()).min(1).optional(),
      salon_staff_id: z.number().int().positive().nullable().optional(),
      starts_at: z.string().min(10),
      notes: z.string().max(2000).nullable().optional(),
      confirm_advance_payment: z.boolean().optional()
    });
    const parsed = body.safeParse(req.body);
    if (!parsed.success) return fail(res, 422, "Validation failed.");
    const normalizedMobile = normalizeMobile(parsed.data.customer_mobile);
    if (!normalizedMobile) return fail(res, 422, "Invalid mobile number.");

    const ctrl = await supabaseAdmin
      .from("shop_customer_controls")
      .select("is_suspended,is_removed")
      .eq("shop_id", shopId)
      .eq("customer_mobile", normalizedMobile)
      .maybeSingle();
    if ((ctrl.data as { is_removed?: boolean } | null)?.is_removed) {
      return fail(res, 403, "Customer is removed from this shop.");
    }
    if ((ctrl.data as { is_suspended?: boolean } | null)?.is_suspended) {
      return fail(res, 403, "Customer is suspended in this shop.");
    }

    const serviceIds =
      parsed.data.salon_service_ids && parsed.data.salon_service_ids.length > 0
        ? [...new Set(parsed.data.salon_service_ids)]
        : parsed.data.salon_service_id != null
          ? [parsed.data.salon_service_id]
          : [];
    if (serviceIds.length === 0) return fail(res, 422, "Select at least one service.");

    const servicesRes = await supabaseAdmin
      .from("salon_services")
      .select(
        "id,name,duration_minutes,buffer_after_minutes,price_cents,is_active,online_bookable,min_notice_hours,deposit_cents"
      )
      .eq("shop_id", shopId)
      .eq("is_active", true)
      .eq("online_bookable", true)
      .in("id", serviceIds);
    const rows = (servicesRes.data ?? []) as {
      id: number;
      name: string;
      duration_minutes: number;
      buffer_after_minutes: number | null;
      price_cents: number | null;
      is_active: boolean | null;
      online_bookable: boolean | null;
      min_notice_hours: number | null;
      deposit_cents: number | null;
    }[];
    if (rows.length !== serviceIds.length) return fail(res, 422, "One or more services are invalid for this shop.");

    const startsAtBooking = new Date(parsed.data.starts_at);
    const minNoticeHours = Math.max(0, ...rows.map((r) => Math.max(0, Number(r.min_notice_hours ?? 0))));
    const earliestOk = new Date(Date.now() + minNoticeHours * 3600_000);
    if (startsAtBooking.getTime() < earliestOk.getTime()) {
      return fail(
        res,
        422,
        minNoticeHours > 0
          ? `One or more services require at least ${minNoticeHours} hour(s) advance booking. Please pick a later time.`
          : "Invalid booking time."
      );
    }

    const order = new Map(serviceIds.map((id, i) => [id, i]));
    rows.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const lineItems = rows.map((r) => ({
      service_id: r.id,
      name: r.name,
      duration_minutes: r.duration_minutes ?? 30,
      price_cents: r.price_cents
    }));
    const totalDuration = rows.reduce(
      (sum, r) => sum + (r.duration_minutes ?? 30) + (r.buffer_after_minutes ?? 0),
      0
    );
    const priced = rows.filter((r) => r.price_cents != null);
    const totalPriceCents =
      priced.length === rows.length ? priced.reduce((s, r) => s + (r.price_cents as number), 0) : null;

    const advancePct = bookingAdvancePercentFromSettings(shopSettings);
    const advanceAmountCents =
      totalPriceCents != null && advancePct > 0 ? Math.round((totalPriceCents * advancePct) / 100) : 0;

    if (advanceAmountCents > 0 && parsed.data.confirm_advance_payment !== true) {
      return fail(res, 422, "Advance payment confirmation is required for this booking.");
    }

    const capableStaffIds = await staffIdsWhoCanDoAllServices(shopId, serviceIds);
    if (capableStaffIds.length === 0) {
      return fail(res, 422, "No staff member is assigned to all selected services. Please contact the salon.");
    }

    let staff = null as { id: number; name: string } | null;
    if (parsed.data.salon_staff_id != null) {
      if (!capableStaffIds.includes(parsed.data.salon_staff_id)) {
        return fail(res, 422, "Selected stylist cannot perform all chosen services.");
      }
      const staffRes = await supabaseAdmin
        .from("salon_staff")
        .select("id,name")
        .eq("id", parsed.data.salon_staff_id)
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .maybeSingle();
      if (!staffRes.data) return fail(res, 422, "Invalid staff.");
      staff = staffRes.data;
    } else {
      const candidatesRes = await supabaseAdmin
        .from("salon_staff")
        .select("id,name")
        .eq("shop_id", shopId)
        .eq("is_active", true)
        .in("id", capableStaffIds)
        .order("sort_order")
        .limit(200);
      const candidates = (candidatesRes.data ?? []) as { id: number; name: string }[];
      for (const c of candidates) {
        const startsAt = new Date(parsed.data.starts_at);
        const endsAt = new Date(startsAt.getTime() + Math.max(15, totalDuration) * 60_000);
        // Auto-assign first capable staff who is actually free at the requested slot.
        const free = await isStaffFreeAt(shopId, c.id, startsAt, endsAt);
        if (free) {
          staff = c;
          break;
        }
      }
    }
    if (!staff) return fail(res, 422, "No available staff.");

    const startsAt = new Date(parsed.data.starts_at);
    const endsAt = new Date(startsAt.getTime() + Math.max(15, totalDuration) * 60_000);
    const finalFree = await isStaffFreeAt(shopId, staff.id, startsAt, endsAt);
    if (!finalFree) {
      return fail(res, 422, "This slot has already been booked. Please choose another time.");
    }
    const primaryServiceId = rows[0].id;
    const customerUserId = optionalCustomerUserId(req);
    const advancePaidCents = advanceAmountCents > 0 && parsed.data.confirm_advance_payment === true ? advanceAmountCents : 0;

    const ins = await supabaseAdmin
      .from("salon_bookings")
      .insert({
        shop_id: shopId,
        salon_service_id: primaryServiceId,
        salon_staff_id: staff.id,
        customer_name: parsed.data.customer_name,
        customer_mobile: normalizedMobile,
        customer_user_id: customerUserId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        status: "pending",
        source: "web",
        notes: parsed.data.notes ?? null,
        line_items: lineItems,
        total_price_cents: totalPriceCents,
        advance_percent_snapshot: advancePct,
        advance_amount_cents: advanceAmountCents,
        advance_paid_cents: advancePaidCents
      })
      .select("id,customer_name,customer_mobile,starts_at,ends_at,status,source,notes")
      .single();
    if (ins.error || !ins.data) return fail(res, 500, "Could not create booking.");
    await notifyStaffAndManagersAboutPendingBooking({
      shopId,
      assignedStaffId: staff.id,
      bookingId: Number((ins.data as { id: number }).id),
      customerName: parsed.data.customer_name,
      startsAtIso: startsAt.toISOString()
    });

    const first = rows[0];
    return okData(
      res,
      {
        ...ins.data,
        shop: null,
        line_items: lineItems,
        total_price_cents: totalPriceCents,
        advance_percent_snapshot: advancePct,
        advance_amount_cents: advanceAmountCents,
        advance_paid_cents: advancePaidCents,
        service: {
          id: first.id,
          name: first.name,
          duration_minutes: first.duration_minutes,
          price_cents: first.price_cents ?? null
        },
        staff
      },
      201
    );
  });
}
