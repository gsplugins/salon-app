import { authJson, formatApiError, type ApiErrorBody } from "@/lib/auth-api";

export type SalonServiceRow = {
  id: number;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
  category?: string | null;
  buffer_after_minutes?: number;
  is_active?: boolean;
  sort_order?: number;
};

export type SalonStaffOption = { id: number | null; name: string };

export type BookingRow = {
  id: number;
  customer_name: string;
  customer_mobile: string;
  shop?: { id: number; name: string; slug: string } | null;
  service: {
    id: number;
    name: string;
    duration_minutes: number;
    category?: string | null;
    price_cents?: number | null;
  };
  staff: { id: number; name: string };
  starts_at: string;
  ends_at: string;
  status: string;
  source: string;
  notes: string | null;
};

export type BlockedSlotRow = {
  id: number;
  salon_staff_id: number | null;
  staff: { id: number; name: string } | null;
  scope: "staff" | "shop";
  starts_at: string;
  ends_at: string;
  kind: string;
  reason: string | null;
};

function shopBase(slug: string): string {
  return `/shops/${encodeURIComponent(slug)}`;
}

export async function fetchShopMeta(
  slug: string
): Promise<{ ok: true; data: { id: number; name: string; slug: string; description: string | null } } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: { id: number; name: string; slug: string; description: string | null } }>(
    `${shopBase(slug)}/meta`
  );
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchSalonServices(
  shopSlug: string
): Promise<{ ok: true; data: SalonServiceRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: SalonServiceRow[] }>(`${shopBase(shopSlug)}/services`);
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchSalonStaff(
  shopSlug: string,
  serviceId: number
): Promise<{ ok: true; data: SalonStaffOption[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams({ service_id: String(serviceId) });
  const res = await authJson<{ data: SalonStaffOption[] }>(`${shopBase(shopSlug)}/staff?${q.toString()}`);
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchAvailability(
  shopSlug: string,
  serviceId: number,
  dateYmd: string,
  staffId: number | null
): Promise<{ ok: true; data: string[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams({
    service_id: String(serviceId),
    date: dateYmd,
  });
  if (staffId !== null) q.set("staff_id", String(staffId));
  const res = await authJson<{ data: string[] }>(`${shopBase(shopSlug)}/availability?${q.toString()}`);
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createPublicBooking(
  shopSlug: string,
  body: {
    customer_name: string;
    customer_mobile: string;
    salon_service_id: number;
    salon_staff_id?: number | null;
    starts_at: string;
    notes?: string | null;
  },
  opts?: { accessToken?: string }
): Promise<{ ok: true; data: BookingRow } | { ok: false; body: ApiErrorBody }> {
  const payload: Record<string, unknown> = {
    customer_name: body.customer_name,
    customer_mobile: body.customer_mobile,
    salon_service_id: body.salon_service_id,
    starts_at: body.starts_at,
  };
  if (body.salon_staff_id != null) payload.salon_staff_id = body.salon_staff_id;
  if (body.notes != null && String(body.notes).trim() !== "") payload.notes = String(body.notes).trim();

  const res = await authJson<{ data: BookingRow }>(`${shopBase(shopSlug)}/bookings`, {
    method: "POST",
    body: JSON.stringify(payload),
    ...(opts?.accessToken ? { accessToken: opts.accessToken } : {}),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchCustomerBooking(
  accessToken: string,
  bookingId: number,
  body:
    | { status: "cancelled" }
    | { starts_at: string; salon_staff_id?: number | null }
): Promise<{ ok: true; data: BookingRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BookingRow }>(`/me/bookings/${bookingId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchAdminBookings(
  fromIsoDate: string,
  toIsoDate: string,
  accessToken: string
): Promise<{ ok: true; data: BookingRow[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams({ from: fromIsoDate, to: toIsoDate });
  const res = await authJson<{ data: BookingRow[] }>(`/my/shop/bookings?${q.toString()}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createWalkInBooking(
  accessToken: string,
  body: {
    customer_name: string;
    customer_mobile: string;
    salon_service_id: number;
    salon_staff_id?: number | null;
    starts_at: string;
    status?: string;
    notes?: string | null;
  }
): Promise<{ ok: true; data: BookingRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BookingRow }>("/my/shop/bookings", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchBooking(
  accessToken: string,
  bookingId: number,
  body: { status?: string; notes?: string | null; starts_at?: string; salon_staff_id?: number | null }
): Promise<{ ok: true; data: BookingRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BookingRow }>(`/my/shop/bookings/${bookingId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchBlockedSlots(
  fromIsoDate: string,
  toIsoDate: string,
  accessToken: string
): Promise<{ ok: true; data: BlockedSlotRow[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams({ from: fromIsoDate, to: toIsoDate });
  const res = await authJson<{ data: BlockedSlotRow[] }>(`/my/shop/blocked-slots?${q.toString()}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createBlockedSlot(
  accessToken: string,
  body: {
    salon_staff_id?: number | null;
    starts_at: string;
    ends_at: string;
    kind: string;
    reason?: string | null;
  }
): Promise<{ ok: true; data: BlockedSlotRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BlockedSlotRow }>("/my/shop/blocked-slots", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function deleteBlockedSlot(
  accessToken: string,
  id: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ message?: string }>(`/my/shop/blocked-slots/${id}`, {
    method: "DELETE",
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export type ShopProfile = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
};

export type ShopStats = {
  bookings_today: number;
  bookings_this_week: number;
  completed_this_week: number;
  pending_upcoming: number;
  estimated_revenue_cents_this_week: number;
};

export type ShopClientRow = {
  customer_mobile: string;
  customer_name: string;
  visit_count: number;
  last_visit_at: string;
};

export type CatalogServiceRow = {
  id: number;
  name: string;
  category: string | null;
  duration_minutes: number;
  buffer_after_minutes: number;
  price_cents: number | null;
  is_active: boolean;
  sort_order: number;
};

export type CatalogStaffRow = {
  id: number;
  name: string;
  is_active: boolean;
  sort_order: number;
  services: { id: number; name: string }[];
};

export async function fetchShopProfile(
  accessToken: string
): Promise<{ ok: true; data: ShopProfile } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: ShopProfile }>("/my/shop/profile", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchShopProfile(
  accessToken: string,
  body: {
    name?: string;
    description?: string | null;
    phone?: string | null;
    email?: string | null;
    address?: string | null;
    settings?: Record<string, unknown>;
  }
): Promise<{ ok: true; data: ShopProfile } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: ShopProfile }>("/my/shop/profile", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchShopStats(
  accessToken: string
): Promise<{ ok: true; data: ShopStats } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: ShopStats }>("/my/shop/stats", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchShopClients(
  accessToken: string
): Promise<{ ok: true; data: ShopClientRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: ShopClientRow[] }>("/my/shop/clients", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchServicesCatalog(
  accessToken: string
): Promise<{ ok: true; data: CatalogServiceRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CatalogServiceRow[] }>("/my/shop/services-catalog", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createServiceCatalog(
  accessToken: string,
  body: {
    name: string;
    category?: string | null;
    duration_minutes: number;
    buffer_after_minutes?: number;
    price_cents?: number | null;
    is_active?: boolean;
    sort_order?: number;
  }
): Promise<{ ok: true; data: CatalogServiceRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CatalogServiceRow }>("/my/shop/services-catalog", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function updateServiceCatalog(
  accessToken: string,
  serviceId: number,
  body: Partial<{
    name: string;
    category: string | null;
    duration_minutes: number;
    buffer_after_minutes: number;
    price_cents: number | null;
    is_active: boolean;
    sort_order: number;
  }>
): Promise<{ ok: true; data: CatalogServiceRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CatalogServiceRow }>(`/my/shop/services-catalog/${serviceId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function deleteServiceCatalog(
  accessToken: string,
  serviceId: number
): Promise<
  | { ok: true; message?: string; deactivated?: boolean; data?: CatalogServiceRow }
  | { ok: false; body: ApiErrorBody }
> {
  const res = await authJson<{ message?: string; data?: CatalogServiceRow }>(
    `/my/shop/services-catalog/${serviceId}`,
    {
      method: "DELETE",
      accessToken,
    }
  );
  if (!res.ok) return { ok: false, body: res.body };
  return {
    ok: true,
    message: res.data.message,
    deactivated: Boolean(res.data.data),
    data: res.data.data,
  };
}

export async function fetchStaffCatalog(
  accessToken: string
): Promise<{ ok: true; data: CatalogStaffRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CatalogStaffRow[] }>("/my/shop/staff-catalog", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createStaffCatalog(
  accessToken: string,
  body: {
    name: string;
    is_active?: boolean;
    sort_order?: number;
    service_ids?: number[];
  }
): Promise<{ ok: true; data: CatalogStaffRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CatalogStaffRow }>("/my/shop/staff-catalog", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function updateStaffCatalog(
  accessToken: string,
  staffId: number,
  body: Partial<{
    name: string;
    is_active: boolean;
    sort_order: number;
    service_ids: number[];
  }>
): Promise<{ ok: true; data: CatalogStaffRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CatalogStaffRow }>(`/my/shop/staff-catalog/${staffId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function deleteStaffCatalog(
  accessToken: string,
  staffId: number
): Promise<
  | { ok: true; message?: string; deactivated?: boolean; data?: CatalogStaffRow }
  | { ok: false; body: ApiErrorBody }
> {
  const res = await authJson<{ message?: string; data?: CatalogStaffRow }>(`/my/shop/staff-catalog/${staffId}`, {
    method: "DELETE",
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return {
    ok: true,
    message: res.data.message,
    deactivated: Boolean(res.data.data),
    data: res.data.data,
  };
}

export type SystemShopFilter = "all" | "paid" | "unpaid" | "expired" | "locked";

export type SystemShopRow = {
  id: number;
  name: string;
  slug: string;
  is_active: boolean;
  created_at?: string;
  owner?: {
    id: number;
    name: string;
    mobile: string;
    role: string;
    is_locked?: boolean;
    created_at?: string;
  };
  subscription?: {
    id: number;
    status: string;
    plan_key: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
  };
};

export type BkashPaymentRow = {
  id: number;
  shop_id: number;
  amount_paisa: number;
  trx_id: string | null;
  status: string;
  payer_mobile: string | null;
  note: string | null;
  created_at: string;
  shop?: { id: number; name: string; slug: string };
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export async function fetchSystemShops(
  accessToken: string,
  opts?: { search?: string; filter?: SystemShopFilter; page?: number }
): Promise<{ ok: true; data: Paginated<SystemShopRow> } | { ok: false; body: ApiErrorBody }> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.filter && opts.filter !== "all") params.set("filter", opts.filter);
  if (opts?.page && opts.page > 1) params.set("page", String(opts.page));
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authJson<Paginated<SystemShopRow>>(`/system/shops${q}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function patchSystemUser(
  accessToken: string,
  userId: number,
  body: { is_locked?: boolean; name?: string; role?: string }
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/system/users/${userId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function postSystemResetPassword(
  accessToken: string,
  userId: number,
  password: string
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ message?: string }>(`/system/users/${userId}/reset-password`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({ password }),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function postExtendSubscription(
  accessToken: string,
  subscriptionId: number,
  days: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/system/subscriptions/${subscriptionId}/extend`, {
    method: "POST",
    accessToken,
    body: JSON.stringify({ days }),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function fetchBkashPayments(
  accessToken: string,
  page?: number
): Promise<{ ok: true; data: Paginated<BkashPaymentRow> } | { ok: false; body: ApiErrorBody }> {
  const q = page && page > 1 ? `?page=${page}` : "";
  const res = await authJson<Paginated<BkashPaymentRow>>(`/system/bkash-payments${q}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function createBkashPayment(
  accessToken: string,
  body: {
    shop_id: number;
    amount_paisa: number;
    trx_id?: string | null;
    status?: string;
    payer_mobile?: string | null;
    note?: string | null;
  }
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/system/bkash-payments", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function patchSystemShop(
  accessToken: string,
  shopId: number,
  body: { is_active?: boolean; name?: string; slug?: string }
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/system/shops/${shopId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export type PublicShopListRow = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  phone: string | null;
  photos?: string[] | null;
};

export type PublicShopDetailPayload = {
  shop: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
    latitude: string | null;
    longitude: string | null;
    photos: string[];
    parent_shop_id: number | null;
  };
  services: {
    id: number;
    name: string;
    category: string | null;
    duration_minutes: number;
    buffer_after_minutes: number;
    price_cents: number | null;
  }[];
  staff: {
    id: number;
    name: string;
    bio: string | null;
    photo_url: string | null;
    specialties: unknown;
  }[];
  reviews_summary: { count: number; avg_rating: number | null };
  reviews: {
    id: number;
    rating: number;
    comment: string | null;
    created_at: string | null;
    staff_name: string | null;
  }[];
};

export async function fetchPublicShopsDirectory(opts?: {
  search?: string;
  perPage?: number;
  page?: number;
}): Promise<{ ok: true; data: Paginated<PublicShopListRow> } | { ok: false; body: ApiErrorBody }> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.perPage) params.set("per_page", String(opts.perPage));
  if (opts?.page && opts.page > 1) params.set("page", String(opts.page));
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authJson<Paginated<PublicShopListRow>>(`/public/shops${q}`);
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function fetchPublicShopDetail(
  shopId: number
): Promise<{ ok: true; data: PublicShopDetailPayload } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: PublicShopDetailPayload }>(`/public/shops/${shopId}`);
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type PublicBarberProfilePayload = {
  id: number;
  name: string;
  bio: string | null;
  photo_url: string | null;
  specialties: unknown;
  weekly_schedule: unknown;
  shop: { id: number; name: string; slug: string };
  reviews_summary: { count: number; avg_rating: number | null };
  recent_reviews: { id: number; rating: number; comment: string | null; created_at: string | null }[];
};

export async function fetchPublicBarberProfile(
  staffId: number
): Promise<{ ok: true; data: PublicBarberProfilePayload } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: PublicBarberProfilePayload }>(`/public/barbers/${staffId}`);
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type QueueRow = {
  id: number;
  position: number;
  status: string;
  customer_name: string;
  estimated_wait_minutes: number | null;
  staff: { id: number; name: string } | null;
  join_time: string | null;
};

export async function fetchPublicQueue(
  shopId: number
): Promise<{ ok: true; data: QueueRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: QueueRow[] }>(`/public/shops/${shopId}/queue`);
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function postPublicQueueJoin(
  shopId: number,
  body: { customer_name: string; customer_mobile?: string | null },
  accessToken?: string
): Promise<{ ok: true; data: { id: number; position: number } } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: { id: number; position: number } }>(`/public/shops/${shopId}/queue/join`, {
    method: "POST",
    body: JSON.stringify(body),
    ...(accessToken ? { accessToken } : {}),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchCustomerAppointments(
  accessToken: string
): Promise<{ ok: true; data: BookingRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BookingRow[] }>("/me/appointments", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type LoyaltyPayload = {
  points: number;
  transactions: {
    id: number;
    points: number;
    type: string;
    description: string | null;
    created_at: string | null;
  }[];
};

export async function fetchCustomerLoyalty(
  accessToken: string
): Promise<{ ok: true; data: LoyaltyPayload } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: LoyaltyPayload }>("/me/loyalty", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchBarberToday(
  accessToken: string
): Promise<{ ok: true; data: BookingRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BookingRow[] }>("/my/barber/today", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchBarberHistory(
  accessToken: string
): Promise<{ ok: true; data: BookingRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BookingRow[] }>("/my/barber/history", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type BranchRow = {
  id: number;
  name: string;
  slug: string;
  parent_shop_id: number | null;
  is_active?: boolean;
  address?: string | null;
};

export async function fetchOwnerBranches(
  accessToken: string
): Promise<{ ok: true; data: BranchRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BranchRow[] }>("/my/shop/branches", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createOwnerBranch(
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: BranchRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BranchRow }>("/my/shop/branches", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchOwnerBranch(
  accessToken: string,
  shopId: number,
  body: Record<string, unknown>
): Promise<{ ok: true; data: BranchRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: BranchRow }>(`/my/shop/branches/${shopId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type InventoryRow = {
  id: number;
  name: string;
  quantity: string;
  unit: string;
  low_stock_threshold: string | null;
};

export async function fetchOwnerInventory(
  accessToken: string
): Promise<{ ok: true; data: InventoryRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: InventoryRow[] }>("/my/shop/inventory", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createOwnerInventory(
  accessToken: string,
  body: { name: string; quantity: number; unit?: string; low_stock_threshold?: number | null }
): Promise<{ ok: true; data: InventoryRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: InventoryRow }>("/my/shop/inventory", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchOwnerInventory(
  accessToken: string,
  id: number,
  body: Partial<{ name: string; quantity: number; unit: string; low_stock_threshold: number | null }>
): Promise<{ ok: true; data: InventoryRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: InventoryRow }>(`/my/shop/inventory/${id}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function deleteOwnerInventory(
  accessToken: string,
  id: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/my/shop/inventory/${id}`, {
    method: "DELETE",
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export type OwnerReviewRow = {
  id: number;
  rating: number;
  comment: string | null;
  owner_reply: string | null;
  created_at: string | null;
  staff: { id: number; name: string } | null;
  customer: { id: number; name: string } | null;
};

export async function fetchOwnerReviews(
  accessToken: string
): Promise<{ ok: true; data: OwnerReviewRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: OwnerReviewRow[] }>("/my/shop/reviews", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchOwnerReviewReply(
  accessToken: string,
  reviewId: number,
  owner_reply: string
): Promise<{ ok: true; data: OwnerReviewRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: OwnerReviewRow }>(`/my/shop/reviews/${reviewId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ owner_reply }),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type OwnerAnalyticsSummary = {
  from: string;
  to: string;
  total_bookings: number;
  by_status: Record<string, number>;
  revenue_cents_completed: number;
  top_services: { name: string; bookings: number }[];
};

export async function fetchOwnerAnalyticsSummary(
  accessToken: string,
  from: string,
  to: string
): Promise<{ ok: true; data: OwnerAnalyticsSummary } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams({ from, to });
  const res = await authJson<{ data: OwnerAnalyticsSummary }>(`/my/shop/analytics/summary?${q}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type OwnerQueueRow = {
  id: number;
  position: number;
  status: string;
  customer_name: string;
  estimated_wait_minutes: number | null;
  staff: { id: number; name: string } | null;
  customer: { id: number; name: string } | null;
};

export async function fetchOwnerQueueManage(
  accessToken: string
): Promise<{ ok: true; data: OwnerQueueRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: OwnerQueueRow[] }>("/my/shop/queue/manage", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchOwnerQueueStatus(
  accessToken: string,
  id: number,
  status: "waiting" | "in_progress" | "done" | "cancelled"
): Promise<{ ok: true; data: OwnerQueueRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: OwnerQueueRow }>(`/my/shop/queue/${id}/status`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ status }),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type SystemUserRow = {
  id: number;
  name: string;
  mobile: string;
  role: string;
  is_admin: boolean;
  is_locked: boolean;
  created_at: string;
};

export async function fetchSystemUsers(
  accessToken: string,
  opts?: { search?: string; page?: number }
): Promise<{ ok: true; data: Paginated<SystemUserRow> } | { ok: false; body: ApiErrorBody }> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.page && opts.page > 1) params.set("page", String(opts.page));
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authJson<Paginated<SystemUserRow>>(`/system/users${q}`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export { formatApiError };
