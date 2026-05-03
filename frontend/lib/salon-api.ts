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
  description?: string | null;
  audience?: "all" | "men" | "women" | "kids";
  aftercare?: string | null;
  requires_patch_test?: boolean;
  consultation_first?: boolean;
  min_notice_hours?: number;
  online_bookable?: boolean;
  deposit_cents?: number | null;
};

export type SalonStaffOption = { id: number | null; name: string };
export type AvailabilitySlotStatus = "available" | "in_process" | "booked";
export type AvailabilitySlot = { starts_at: string; status: AvailabilitySlotStatus };

export type BookingLineItem = {
  service_id: number;
  name: string;
  duration_minutes: number;
  price_cents: number | null;
};

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
  line_items?: BookingLineItem[];
  total_price_cents?: number | null;
  advance_percent_snapshot?: number;
  advance_amount_cents?: number;
  advance_paid_cents?: number;
  staff: { id: number; name: string };
  starts_at: string;
  ends_at: string;
  status: string;
  source: string;
  notes: string | null;
  payment?: {
    id: number;
    method: string;
    amount_cents: number;
    currency: string;
    status: string;
    transaction_id: string | null;
    tip_cents: number;
    created_at: string;
  } | null;
  review?: {
    id: number;
    rating: number;
    comment: string | null;
    owner_reply: string | null;
    created_at: string | null;
  } | null;
};

export async function createCustomerBookingPayment(
  accessToken: string,
  bookingId: number,
  body: {
    method: "manual" | "bkash";
    tip_cents?: number;
    trx_id?: string | null;
    payer_mobile?: string | null;
    note?: string | null;
  }
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: Record<string, unknown> }>(`/me/bookings/${bookingId}/payments`, {
    method: "POST",
    accessToken,
    body: JSON.stringify(body)
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

/** Display label for one or more services on a booking (API may send line_items or legacy service only). */
export function bookingServicesLabel(b: Pick<BookingRow, "service" | "line_items">): string {
  const items = b.line_items;
  if (Array.isArray(items) && items.length > 0) {
    return items.map((i) => i.name).join(", ");
  }
  return b.service?.name ?? "";
}

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
): Promise<
  | {
      ok: true;
      data: {
        id: number;
        name: string;
        slug: string;
        description: string | null;
        booking_advance_percent: number;
      };
    }
  | { ok: false; body: ApiErrorBody }
> {
  const res = await authJson<{
    data: {
      id: number;
      name: string;
      slug: string;
      description: string | null;
      booking_advance_percent?: number;
    };
  }>(`${shopBase(slug)}/meta`);
  if (!res.ok) return { ok: false, body: res.body };
  const d = res.data.data;
  return {
    ok: true,
    data: {
      ...d,
      booking_advance_percent: typeof d.booking_advance_percent === "number" ? d.booking_advance_percent : 0
    }
  };
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
  serviceIds: number[]
): Promise<{ ok: true; data: SalonStaffOption[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams({ service_ids: serviceIds.join(",") });
  const res = await authJson<{ data: SalonStaffOption[] }>(`${shopBase(shopSlug)}/staff?${q.toString()}`);
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchAvailability(
  shopSlug: string,
  serviceIds: number[],
  dateYmd: string,
  staffId: number | null
): Promise<{ ok: true; data: AvailabilitySlot[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams({
    service_ids: serviceIds.join(","),
    date: dateYmd,
  });
  if (staffId !== null) q.set("staff_id", String(staffId));
  const res = await authJson<{ data: Array<string | AvailabilitySlot> }>(`${shopBase(shopSlug)}/availability?${q.toString()}`);
  if (!res.ok) return { ok: false, body: res.body };
  const normalized: AvailabilitySlot[] = (res.data.data ?? [])
    .map((row) => {
      if (typeof row === "string") return { starts_at: row, status: "available" as const };
      const status = row.status === "booked" || row.status === "in_process" ? row.status : "available";
      const startsAtRaw =
        (row as { starts_at?: unknown; startsAt?: unknown; start_at?: unknown }).starts_at ??
        (row as { starts_at?: unknown; startsAt?: unknown; start_at?: unknown }).startsAt ??
        (row as { starts_at?: unknown; startsAt?: unknown; start_at?: unknown }).start_at;
      const startsAt = typeof startsAtRaw === "string" ? startsAtRaw : "";
      if (!startsAt) return null;
      return { starts_at: startsAt, status };
    })
    .filter((row): row is AvailabilitySlot => Boolean(row && row.starts_at));
  return { ok: true, data: normalized };
}

export async function createPublicBooking(
  shopSlug: string,
  body: {
    customer_name: string;
    customer_mobile: string;
    salon_service_ids: number[];
    salon_staff_id?: number | null;
    starts_at: string;
    notes?: string | null;
    confirm_advance_payment?: boolean;
  },
  opts?: { accessToken?: string }
): Promise<{ ok: true; data: BookingRow } | { ok: false; body: ApiErrorBody }> {
  const payload: Record<string, unknown> = {
    customer_name: body.customer_name,
    customer_mobile: body.customer_mobile,
    salon_service_ids: body.salon_service_ids,
    starts_at: body.starts_at,
  };
  if (body.salon_staff_id != null) payload.salon_staff_id = body.salon_staff_id;
  if (body.notes != null && String(body.notes).trim() !== "") payload.notes = String(body.notes).trim();
  if (body.confirm_advance_payment === true) payload.confirm_advance_payment = true;

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
    | { status: "completed" }
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
  accessToken: string,
  opts?: { from?: string; to?: string; status?: string; staff_id?: number }
): Promise<{ ok: true; data: BookingRow[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  if (opts?.status) q.set("status", opts.status);
  if (typeof opts?.staff_id === "number" && Number.isFinite(opts.staff_id)) q.set("staff_id", String(opts.staff_id));
  const qs = q.toString();
  const res = await authJson<{ data: BookingRow[] }>(`/my/shop/bookings${qs ? `?${qs}` : ""}`, {
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
  accessToken: string,
  staffId?: number | null
): Promise<{ ok: true; data: BlockedSlotRow[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams({ from: fromIsoDate, to: toIsoDate });
  if (staffId != null && Number.isFinite(staffId)) q.set("staff_id", String(staffId));
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
  latitude?: string | null;
  longitude?: string | null;
  is_active: boolean;
  settings: Record<string, unknown>;
  subscription?: {
    status: string;
    plan_key: string;
    plan_name?: string | null;
    trial_ends_at?: string | null;
    current_period_end?: string | null;
    features?: Record<string, unknown>;
  } | null;
  permissions?: {
    can_edit_shop_basics?: boolean;
    can_edit_business_hours?: boolean;
    can_edit_booking_rules?: boolean;
    can_edit_currency?: boolean;
    can_manage_payments?: boolean;
    can_view_subscription?: boolean;
    plan_access_tier?: "free" | "starter" | "pro" | "enterprise";
    plan_access_modules?: Record<string, string[]>;
  };
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
  last_service_name?: string | null;
  customer_type?: "regular" | "other";
  is_suspended?: boolean;
  is_removed?: boolean;
};

export type CatalogServiceRow = {
  id: number;
  name: string;
  category: string | null;
  description?: string | null;
  duration_minutes: number;
  buffer_after_minutes: number;
  price_cents: number | null;
  is_active: boolean;
  sort_order: number;
  audience?: "all" | "men" | "women" | "kids";
  staff_notes?: string | null;
  aftercare?: string | null;
  requires_patch_test?: boolean;
  consultation_first?: boolean;
  min_notice_hours?: number;
  online_bookable?: boolean;
  deposit_cents?: number | null;
};

export type CatalogStaffRow = {
  id: number;
  user_id?: number | null;
  /** True when this row is linked to a user account (barber login). */
  has_staff_login?: boolean;
  name: string;
  position_title?: string | null;
  staff_role?: string | null;
  bio?: string | null;
  specialties?: string[];
  address?: string | null;
  age?: number | null;
  experience_years?: number | null;
  work_mobile?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  login_mobile?: string | null;
  is_active: boolean;
  sort_order: number;
  /** Weekly template for online booking when this staff member is selected. */
  weekly_schedule?: Record<string, unknown>;
  /** Slot step (minutes) for this staff member's online booking grid. */
  online_slot_interval_minutes?: number;
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
    latitude?: string | null;
    longitude?: string | null;
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

export type SalonPaymentRow = {
  id: number;
  shop_id: number;
  salon_booking_id: number | null;
  method: string;
  amount_cents: number;
  currency: string;
  transaction_id: string | null;
  status: string;
  created_at?: string;
  booking?: {
    id: number;
    customer_name: string;
    customer_mobile: string;
    starts_at: string;
  } | null;
};

export type OwnerPaymentsMeta = {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export async function fetchOwnerPayments(
  accessToken: string,
  opts?: { page?: number; per_page?: number; status?: string; method?: string; from?: string; to?: string }
): Promise<
  { ok: true; data: SalonPaymentRow[]; meta: OwnerPaymentsMeta } | { ok: false; body: ApiErrorBody }
> {
  const q = new URLSearchParams();
  if (opts?.page != null) q.set("page", String(opts.page));
  if (opts?.per_page != null) q.set("per_page", String(opts.per_page));
  if (opts?.status) q.set("status", opts.status);
  if (opts?.method) q.set("method", opts.method);
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  const qs = q.toString();
  const res = await authJson<{ data: SalonPaymentRow[]; meta: OwnerPaymentsMeta }>(
    `/my/shop/payments${qs ? `?${qs}` : ""}`,
    { accessToken }
  );
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data, meta: res.data.meta };
}

export async function createOwnerManualPayment(
  accessToken: string,
  body: {
    amount_cents: number;
    method: string;
    currency?: string;
    salon_booking_id?: number | null;
    transaction_id?: string | null;
    status?: "pending" | "completed" | "failed";
  }
): Promise<{ ok: true; data: SalonPaymentRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: SalonPaymentRow }>("/my/shop/payments", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function refundOwnerSalonPayment(
  accessToken: string,
  paymentId: number
): Promise<{ ok: true; data: SalonPaymentRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: SalonPaymentRow }>(`/my/shop/payments/${paymentId}/refund`, {
    method: "PATCH",
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchShopClients(
  accessToken: string,
  opts?: { include_removed?: boolean }
): Promise<{ ok: true; data: ShopClientRow[] } | { ok: false; body: ApiErrorBody }> {
  const q = opts?.include_removed ? "?include_removed=1" : "";
  const res = await authJson<{ data: ShopClientRow[] }>(`/my/shop/clients${q}`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export type ShopCustomerDetails = {
  customer_mobile: string;
  customer_name: string | null;
  is_suspended: boolean;
  is_removed: boolean;
  control_note: string | null;
  control_updated_at: string | null;
  relation?: {
    linked: boolean;
    linked_at: string | null;
    updated_at: string | null;
    customer_type: "regular" | "other";
  };
  user: {
    id: string;
    name: string;
    mobile: string;
    is_locked: boolean;
    created_at: string;
  } | null;
  shops: {
    shop_id: number;
    shop_name: string;
    shop_slug: string;
    visit_count: number;
    last_visit_at: string;
  }[];
  current_shop_service_history: {
    booking_id: number;
    starts_at: string;
    status: string;
    service_name: string | null;
    duration_minutes: number | null;
    price_cents: number | null;
  }[];
};

export async function createShopCustomerRelation(
  accessToken: string,
  body: { customer_mobile: string; customer_name?: string | null; customer_type?: "regular" | "other" }
): Promise<
  | {
      ok: true;
      data: {
        customer_mobile: string;
        customer_name: string | null;
        customer_user_id: string | null;
        customer_type: "regular" | "other";
        source: string;
        created_at: string;
        updated_at: string;
      };
    }
  | { ok: false; body: ApiErrorBody }
> {
  const res = await authJson<{
    data: {
      customer_mobile: string;
      customer_name: string | null;
      customer_user_id: string | null;
      customer_type: "regular" | "other";
      source: string;
      created_at: string;
      updated_at: string;
    };
  }>("/my/shop/customers", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body)
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchShopCustomerType(
  accessToken: string,
  mobile: string,
  customer_type: "regular" | "other"
): Promise<
  | { ok: true; data: { customer_mobile: string; customer_type: "regular" | "other"; updated_at: string } }
  | { ok: false; body: ApiErrorBody }
> {
  const enc = encodeURIComponent(mobile);
  const res = await authJson<{ data: { customer_mobile: string; customer_type: "regular" | "other"; updated_at: string } }>(
    `/my/shop/customers/${enc}/type`,
    {
      method: "PATCH",
      accessToken,
      body: JSON.stringify({ customer_type })
    }
  );
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchShopCustomerDetails(
  accessToken: string,
  mobile: string
): Promise<{ ok: true; data: ShopCustomerDetails } | { ok: false; body: ApiErrorBody }> {
  const enc = encodeURIComponent(mobile);
  const res = await authJson<{ data: ShopCustomerDetails }>(`/my/shop/customers/${enc}/details`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchShopCustomerStatus(
  accessToken: string,
  mobile: string,
  body: { action: "suspend" | "unsuspend" | "remove" | "restore"; note?: string | null }
): Promise<{ ok: true; data: { customer_mobile: string; is_suspended: boolean; is_removed: boolean } } | { ok: false; body: ApiErrorBody }> {
  const enc = encodeURIComponent(mobile);
  const res = await authJson<{ data: { customer_mobile: string; is_suspended: boolean; is_removed: boolean } }>(
    `/my/shop/customers/${enc}/status`,
    {
      method: "PATCH",
      accessToken,
      body: JSON.stringify(body)
    }
  );
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
    description?: string | null;
    duration_minutes: number;
    buffer_after_minutes?: number;
    price_cents?: number | null;
    is_active?: boolean;
    sort_order?: number;
    audience?: "all" | "men" | "women" | "kids";
    staff_notes?: string | null;
    aftercare?: string | null;
    requires_patch_test?: boolean;
    consultation_first?: boolean;
    min_notice_hours?: number;
    online_bookable?: boolean;
    deposit_cents?: number | null;
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
    description: string | null;
    duration_minutes: number;
    buffer_after_minutes: number;
    price_cents: number | null;
    is_active: boolean;
    sort_order: number;
    audience: "all" | "men" | "women" | "kids";
    staff_notes: string | null;
    aftercare: string | null;
    requires_patch_test: boolean;
    consultation_first: boolean;
    min_notice_hours: number;
    online_bookable: boolean;
    deposit_cents: number | null;
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
    position_title?: string | null;
    staff_role?: string | null;
    bio?: string | null;
    specialties?: string[];
    address?: string | null;
    age?: number | null;
    experience_years?: number | null;
    work_mobile?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
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

/** Shop owner only: create staff + barber login (same mobile/password as customer auth). */
export async function createStaffWithAccount(
  accessToken: string,
  body: {
    name: string;
    mobile: string;
    password: string;
    password_confirmation: string;
    position_title?: string | null;
    staff_role?: string | null;
    bio?: string | null;
    specialties?: string[];
    address?: string | null;
    age?: number | null;
    experience_years?: number | null;
    work_mobile?: string | null;
    emergency_contact_name?: string | null;
    emergency_contact_phone?: string | null;
    is_active?: boolean;
    sort_order?: number;
    service_ids?: number[];
  }
): Promise<{ ok: true; data: CatalogStaffRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CatalogStaffRow }>("/my/shop/staff-with-account", {
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
    position_title: string | null;
    staff_role: string | null;
    bio: string | null;
    specialties: string[];
    address: string | null;
    age: number | null;
    experience_years: number | null;
    work_mobile: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    mobile: string;
    password: string;
    password_confirmation: string;
    is_active: boolean;
    sort_order: number;
    service_ids: number[];
    weekly_schedule?: Record<string, unknown>;
    online_slot_interval_minutes?: number;
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
  approval_status?: "pending" | "approved" | "rejected" | string;
  staff_limit?: number;
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
    active_from?: string | null;
    trial_ends_at: string | null;
    current_period_end: string | null;
  };
  payment_summary?: {
    total_paid_paisa: number;
    payments_count: number;
    last_payment_at: string | null;
    last_payment_amount_paisa: number | null;
    last_payment_status: string | null;
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

export type AdminAuditLogRow = {
  id: number;
  admin_user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export async function fetchSystemShops(
  accessToken: string,
  opts?: {
    search?: string;
    filter?: SystemShopFilter;
    page?: number;
    plan_key?: string;
    created_from?: string;
    created_to?: string;
  }
): Promise<{ ok: true; data: Paginated<SystemShopRow> } | { ok: false; body: ApiErrorBody }> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.filter && opts.filter !== "all") params.set("filter", opts.filter);
  if (opts?.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts?.plan_key) params.set("plan_key", opts.plan_key);
  if (opts?.created_from) params.set("created_from", opts.created_from);
  if (opts?.created_to) params.set("created_to", opts.created_to);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authJson<Paginated<SystemShopRow>>(`/system/shops${q}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function fetchAdminAuditLogs(
  accessToken: string,
  opts?: { action?: string; page?: number; from?: string; to?: string }
): Promise<{ ok: true; data: Paginated<AdminAuditLogRow> } | { ok: false; body: ApiErrorBody }> {
  const params = new URLSearchParams();
  if (opts?.action) params.set("action", opts.action);
  if (opts?.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts?.from) params.set("from", opts.from);
  if (opts?.to) params.set("to", opts.to);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authJson<Paginated<AdminAuditLogRow>>(`/admin/audit-logs${q}`, {
    accessToken
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
  body: {
    is_active?: boolean;
    name?: string;
    slug?: string;
    description?: string | null;
    approval_status?: "pending" | "approved" | "rejected";
    staff_limit?: number;
  }
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/system/shops/${shopId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function deleteSystemShop(
  accessToken: string,
  shopId: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/system/shops/${shopId}`, {
    method: "DELETE",
    accessToken,
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
  latitude?: string | null;
  longitude?: string | null;
  google_maps_url?: string | null;
  logo_url?: string | null;
  division?: string | null;
  district?: string | null;
  city?: string | null;
  photos?: string[] | null;
};

export type PublicShopDetailPayload = {
  shop: {
    id: number;
    name: string;
    slug: string;
    description: string | null;
    category?: string | null;
    categories?: string[];
    phone: string | null;
    whatsapp_phone?: string | null;
    email: string | null;
    address: string | null;
    area?: string | null;
    google_maps_url?: string | null;
    latitude: string | null;
    longitude: string | null;
    photos: string[];
    logo_url?: string | null;
    cover_photo_url?: string | null;
    website?: string | null;
    social_profiles?: { platform: string; url: string }[];
    facebook_url?: string | null;
    instagram_url?: string | null;
    established_year?: number | null;
    weekly_holidays?: string[];
    delivery_available?: boolean;
    payment_methods?: string[];
    division?: string | null;
    district?: string | null;
    city?: string | null;
    parent_shop_id: number | null;
  };
  offers?: {
    title: string;
    description: string | null;
    discount_text: string | null;
    valid_until: string | null;
  }[];
  services: {
    id: number;
    name: string;
    category: string | null;
    description?: string | null;
    duration_minutes: number;
    buffer_after_minutes: number;
    price_cents: number | null;
    audience?: "all" | "men" | "women" | "kids";
    aftercare?: string | null;
    requires_patch_test?: boolean;
    consultation_first?: boolean;
    min_notice_hours?: number;
    online_bookable?: boolean;
    deposit_cents?: number | null;
  }[];
  staff: {
    id: number;
    name: string;
    bio: string | null;
    photo_url: string | null;
    specialties: unknown;
  }[];
  booking_stats?: {
    pending: number;
    confirmed: number;
    cancelled: number;
    completed: number;
    total_customers: number;
  };
  reviews_summary: { count: number; avg_rating: number | null };
  reviews: {
    id: number;
    rating: number;
    comment: string | null;
    created_at: string | null;
    staff_name: string | null;
    customer_name?: string | null;
    customer_photo_url?: string | null;
  }[];
};

export async function fetchPublicShopsDirectory(opts?: {
  search?: string;
  division?: string;
  district?: string;
  city?: string;
  perPage?: number;
  page?: number;
}): Promise<{ ok: true; data: Paginated<PublicShopListRow> } | { ok: false; body: ApiErrorBody }> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.division) params.set("division", opts.division);
  if (opts?.district) params.set("district", opts.district);
  if (opts?.city) params.set("city", opts.city);
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
  photo_gallery_urls?: string[];
  specialties: unknown;
  position_title?: string | null;
  staff_role?: string | null;
  experience_years?: number | null;
  address?: string | null;
  work_mobile?: string | null;
  weekly_schedule: unknown;
  shop: { id: number; name: string; slug: string };
  services?: { id: number; name: string; duration_minutes: number; price_cents: number | null }[];
  stats?: { completed_bookings: number };
  reviews_summary: { count: number; avg_rating: number | null };
  recent_reviews: {
    id: number;
    rating: number;
    comment: string | null;
    created_at: string | null;
    customer_name?: string | null;
    customer_photo_url?: string | null;
  }[];
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

export type CustomerReviewRow = {
  id: number;
  booking_id: number | null;
  rating: number;
  comment: string | null;
  created_at: string | null;
  staff_name: string | null;
  shop: { id: number; name: string; slug: string | null } | null;
};

export type CustomerNotificationRow = {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  metadata: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string | null;
  salon_booking_id: number | null;
};

export type WaitlistRow = {
  id: number;
  shop_id: number;
  service_id: number;
  staff_id: number | null;
  preferred_date: string;
  status: "waiting" | "notified" | "booked" | "expired" | "cancelled" | string;
  notified_at: string | null;
  created_at: string;
};

export async function fetchCustomerReviews(
  accessToken: string
): Promise<{ ok: true; data: CustomerReviewRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CustomerReviewRow[] }>("/me/reviews", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createCustomerReview(
  accessToken: string,
  bookingId: number,
  body: { rating: number; comment?: string | null }
): Promise<{ ok: true; data: CustomerReviewRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CustomerReviewRow }>(`/me/bookings/${bookingId}/review`, {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchCustomerNotifications(
  accessToken: string
): Promise<{ ok: true; data: CustomerNotificationRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: CustomerNotificationRow[] }>("/me/notifications", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function markCustomerNotificationRead(
  accessToken: string,
  id: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/me/notifications/${id}/read`, { method: "PATCH", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function markAllCustomerNotificationsRead(
  accessToken: string
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/me/notifications/read-all", { method: "POST", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function joinWaitlist(
  accessToken: string,
  body: { shop_id: number; service_id: number; preferred_date: string; staff_id?: number | null }
): Promise<{ ok: true; data: WaitlistRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: WaitlistRow }>("/waitlist/join", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body)
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchMyWaitlist(
  accessToken: string
): Promise<{ ok: true; data: WaitlistRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: WaitlistRow[] }>("/waitlist/my", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function removeMyWaitlistEntry(
  accessToken: string,
  waitlistId: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/waitlist/${waitlistId}`, { method: "DELETE", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
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
  sku?: string | null;
  cost_price_cents?: number | null;
  supplier_notes?: string | null;
};

export type ServiceInventoryLinkRow = {
  id: number;
  salon_service_id: number;
  inventory_item_id: number;
  quantity_per_service: string;
  staff_note: string | null;
  material_cost_cents: number | null;
  product: {
    id: number;
    name: string;
    unit: string;
    quantity: string;
    low_stock_threshold: string | null;
    sku: string | null;
    cost_price_cents: number | null;
    supplier_notes: string | null;
  } | null;
};

export async function fetchOwnerInventory(
  accessToken: string
): Promise<{ ok: true; data: InventoryRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: InventoryRow[] }>("/my/shop/inventory", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchServiceInventoryLinks(
  accessToken: string,
  serviceId: number
): Promise<{ ok: true; data: ServiceInventoryLinkRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: ServiceInventoryLinkRow[] }>(`/my/shop/services-catalog/${serviceId}/inventory`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function putServiceInventoryLinks(
  accessToken: string,
  serviceId: number,
  body: {
    items: {
      inventory_item_id: number;
      quantity_per_service: number;
      staff_note?: string | null;
      material_cost_cents?: number | null;
    }[];
  }
): Promise<{ ok: true; data: { saved: number } } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: { saved: number } }>(`/my/shop/services-catalog/${serviceId}/inventory`, {
    method: "PUT",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createOwnerInventory(
  accessToken: string,
  body: {
    name: string;
    quantity: number;
    unit?: string;
    low_stock_threshold?: number | null;
    sku?: string | null;
    cost_price_cents?: number | null;
    supplier_notes?: string | null;
  }
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
  body: Partial<{
    name: string;
    quantity: number;
    unit: string;
    low_stock_threshold: number | null;
    sku: string | null;
    cost_price_cents: number | null;
    supplier_notes: string | null;
  }>
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

export type OwnerCustomerRiskProfile = {
  customer_name: string;
  customer_mobile: string;
  total_bookings: number;
  completed: number;
  confirmed: number;
  pending: number;
  cancelled: number;
  no_show: number;
  cancellation_rate_percent: number;
  risk_level: "low" | "medium" | "high";
  last_visit_at: string | null;
};

export async function fetchOwnerReviews(
  accessToken: string
): Promise<{ ok: true; data: OwnerReviewRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: OwnerReviewRow[] }>("/my/shop/reviews", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchOwnerCustomerRiskProfile(
  accessToken: string,
  mobile: string
): Promise<{ ok: true; data: OwnerCustomerRiskProfile } | { ok: false; body: ApiErrorBody }> {
  const enc = encodeURIComponent(mobile);
  const res = await authJson<{ data: OwnerCustomerRiskProfile }>(`/my/shop/customers/${enc}/profile`, { accessToken });
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
  top_services_revenue?: { name: string; bookings: number; revenue_cents: number }[];
  top_staff?: { name: string; bookings: number }[];
  comparison?: {
    from: string;
    to: string;
    total_bookings: number;
    revenue_cents_completed: number;
  };
  cancellation_rate_percent?: number;
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

export type OwnerWaitlistRow = {
  id: number;
  shop_id: number;
  service_id: number;
  staff_id: number | null;
  customer_id: string | null;
  customer_mobile: string | null;
  preferred_date: string;
  status: string;
  notified_at: string | null;
  created_at: string;
  service: { id: number; name: string } | null;
  staff: { id: number; name: string } | null;
};

export async function fetchOwnerQueueManage(
  accessToken: string
): Promise<{ ok: true; data: OwnerQueueRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: OwnerQueueRow[] }>("/my/shop/queue/manage", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchOwnerWaitlist(
  accessToken: string,
  opts?: { preferred_date?: string; status?: string }
): Promise<{ ok: true; data: OwnerWaitlistRow[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.preferred_date) q.set("preferred_date", opts.preferred_date);
  if (opts?.status) q.set("status", opts.status);
  const qs = q.toString();
  const res = await authJson<{ data: OwnerWaitlistRow[] }>(`/my/shop/waitlist${qs ? `?${qs}` : ""}`, {
    accessToken
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchOwnerWaitlist(
  accessToken: string,
  id: number,
  body: { staff_id?: number | null; status?: string }
): Promise<{ ok: true; data: OwnerWaitlistRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: OwnerWaitlistRow }>(`/my/shop/waitlist/${id}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body)
  });
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
  opts?: { search?: string; page?: number; role?: string; status?: "active" | "locked" }
): Promise<{ ok: true; data: Paginated<SystemUserRow> } | { ok: false; body: ApiErrorBody }> {
  const params = new URLSearchParams();
  if (opts?.search) params.set("search", opts.search);
  if (opts?.page && opts.page > 1) params.set("page", String(opts.page));
  if (opts?.role) params.set("role", opts.role);
  if (opts?.status) params.set("status", opts.status);
  const q = params.toString() ? `?${params.toString()}` : "";
  const res = await authJson<Paginated<SystemUserRow>>(`/system/users${q}`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export { formatApiError };
