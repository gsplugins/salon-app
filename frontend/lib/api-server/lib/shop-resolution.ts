import { supabaseAdmin } from "./supabase";
import type { ShopRow } from "../salon-types";

const ACT_AS_HEADER = "x-salon-act-as-shop-slug";

export function actAsShopSlugFromRequest(headers: Record<string, unknown>): string | null {
  const raw = headers[ACT_AS_HEADER] ?? headers["X-Salon-Act-As-Shop-Slug"];
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  return t === "" ? null : t;
}

async function userHasShopAccess(userId: string, shopId: number): Promise<boolean> {
  const own = await supabaseAdmin.from("shops").select("id").eq("id", shopId).eq("owner_user_id", userId).maybeSingle();
  if (own.data) return true;
  const mem = await supabaseAdmin
    .from("shop_members")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (mem.data) return true;
  const st = await supabaseAdmin
    .from("salon_staff")
    .select("id")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  return Boolean(st.data);
}

async function fetchShopBySlug(slug: string): Promise<ShopRow | null> {
  const res = await supabaseAdmin.from("shops").select("*").eq("slug", slug).maybeSingle();
  return (res.data as ShopRow | null) ?? null;
}

async function primaryShopForUser(userId: string, role: string): Promise<ShopRow | null> {
  const owned = await supabaseAdmin.from("shops").select("*").eq("owner_user_id", userId).order("id").limit(1).maybeSingle();
  if (owned.data) return owned.data as ShopRow;

  const memberRows = await supabaseAdmin
    .from("shop_members")
    .select("shop_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .in("role", ["owner", "manager"])
    .order("id")
    .limit(1);
  const mid = memberRows.data?.[0]?.shop_id;
  if (mid != null) {
    const s = await supabaseAdmin.from("shops").select("*").eq("id", mid).maybeSingle();
    if (s.data) return s.data as ShopRow;
  }

  const staffRow = await supabaseAdmin
    .from("salon_staff")
    .select("shop_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("id")
    .limit(1)
    .maybeSingle();
  if (staffRow.data?.shop_id != null) {
    const s = await supabaseAdmin.from("shops").select("*").eq("id", staffRow.data.shop_id).maybeSingle();
    if (s.data) return s.data as ShopRow;
  }

  if (role === "super_admin") {
    const any = await supabaseAdmin.from("shops").select("*").order("id").limit(1).maybeSingle();
    if (any.data) return any.data as ShopRow;
  }

  return null;
}

export async function resolveManagementShop(
  userId: string,
  role: string,
  headers: Record<string, unknown>
): Promise<ShopRow | null> {
  const slug = actAsShopSlugFromRequest(headers);

  if (role === "super_admin" && slug) {
    return fetchShopBySlug(slug);
  }

  if (slug) {
    const shop = await fetchShopBySlug(slug);
    if (shop && (await userHasShopAccess(userId, shop.id))) return shop;
  }

  return primaryShopForUser(userId, role);
}

export async function shopMemberRole(
  userId: string,
  shopId: number
): Promise<"owner" | "manager" | "barber" | null> {
  const shop = await supabaseAdmin.from("shops").select("owner_user_id").eq("id", shopId).maybeSingle();
  if (shop.data && (shop.data as { owner_user_id: string | null }).owner_user_id === userId) return "owner";
  const m = await supabaseAdmin
    .from("shop_members")
    .select("role")
    .eq("shop_id", shopId)
    .eq("user_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  const r = (m.data as { role: string } | null)?.role;
  if (r === "owner" || r === "manager" || r === "barber") return r;
  return null;
}

export async function staffScopeIdForUser(userId: string, role: string, shopId: number): Promise<number | null> {
  if (role !== "barber") return null;
  const row = await supabaseAdmin
    .from("salon_staff")
    .select("id")
    .eq("user_id", userId)
    .eq("shop_id", shopId)
    .eq("is_active", true)
    .maybeSingle();
  return row.data?.id ?? null;
}

