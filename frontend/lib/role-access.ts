import type { AuthMePayload } from "@/lib/auth-api";

/** Shop owner, salon staff (barber role), or platform super admin — `/owner/*` and `/my/shop/*`. */
export function canAccessSalonManagement(me: AuthMePayload): boolean {
  if (me.is_super_admin || me.role === "super_admin") return true;
  if (me.is_shop_owner || me.role === "shop_owner") return true;
  if (me.role === "barber") return true;
  return false;
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
