import type { AuthMePayload } from "@/lib/auth-api";
import { ownerShopBase } from "@/lib/owner-shop-paths";

export function getPrimaryDashboardPath(me: AuthMePayload): string {
  if (me.is_super_admin || me.role === "super_admin") return "/admin/dashboard";
  if (me.shop?.slug && (me.is_shop_owner || me.role === "shop_owner")) return ownerShopBase(me.shop.slug);
  if (me.shop?.slug && (me.is_manager || me.role === "manager")) return ownerShopBase(me.shop.slug);
  if (me.is_shop_owner || me.role === "shop_owner") return "/owner/dashboard";
  if (me.is_manager || me.role === "manager") return "/owner/dashboard";
  if (me.role === "barber") return "/staff/dashboard";
  return "/customer/dashboard";
}

export function getRoleLabel(me: AuthMePayload): string {
  if (me.is_super_admin || me.role === "super_admin") return "Super admin";
  if (me.is_shop_owner || me.role === "shop_owner") return "Shop owner";
  if (me.is_manager || me.role === "manager") return "Manager";
  if (me.role === "barber") return "Salon staff";
  if (me.role === "customer") return "Customer";
  return me.role || "Account";
}
