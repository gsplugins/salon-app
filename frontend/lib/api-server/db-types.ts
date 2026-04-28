export type DbUser = {
  id: string;
  name: string;
  mobile: string;
  photo_url?: string | null;
  password_hash: string;
  role: "customer" | "shop_owner" | "barber" | "staff" | "super_admin";
  is_locked: boolean;
  loyalty_points: number;
};

