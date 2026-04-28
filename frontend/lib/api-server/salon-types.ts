import type { DbUser } from "./db-types";

export type ShopRow = {
  id: number;
  owner_user_id: string | null;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  settings: Record<string, unknown> | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  latitude: string | null;
  longitude: string | null;
  photos: unknown;
  parent_shop_id: number | null;
};

export type SalonContext = {
  user: DbUser;
  shop: ShopRow;
  staffScopeId: number | null;
};

