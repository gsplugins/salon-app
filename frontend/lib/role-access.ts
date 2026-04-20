import type { AuthMePayload } from "@/lib/auth-api";

/** Shop owner, manager, stylist (barber), or platform super admin — `/owner/*` and `/my/shop/*`. */
export function canAccessSalonManagement(me: AuthMePayload): boolean {
  if (me.is_super_admin || me.role === "super_admin") return true;
  if (me.is_shop_owner || me.role === "shop_owner") return true;
  if (me.is_manager || me.role === "manager") return true;
  if (me.role === "barber") return true;
  if (me.is_admin && me.role !== "customer") return true;
  return false;
}

/** Subscription / billing UI — owners (and super admin) only; managers see `subscription: null` from API. */
export function canViewShopBilling(me: AuthMePayload): boolean {
  if (me.is_super_admin || me.role === "super_admin") return true;
  return me.is_shop_owner || me.role === "shop_owner";
}

/** Customer-only areas: `/dashboard` (appointments & loyalty API). */
export function canAccessCustomerPortal(me: AuthMePayload): boolean {
  return me.role === "customer";
}

/** Platform admin: `/admin/*`, `/api/system/*`. */
export function canAccessSuperAdmin(me: AuthMePayload): boolean {
  return me.is_super_admin || me.role === "super_admin";
}

/** Stylist schedule APIs (`/my/barber/*`) — account role `barber` with staff profile, not shop owner dashboard. */
export function canAccessBarberStaffRoutes(me: AuthMePayload): boolean {
  return me.role === "barber";
}

export function isShopOwnerLike(me: AuthMePayload): boolean {
  return me.is_shop_owner || me.role === "shop_owner";
}
