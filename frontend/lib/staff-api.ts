/**
 * Barber/staff panel — `GET/PATCH /api/staff/*` (JWT + staff_barber middleware).
 */

import { authJson, type ApiErrorBody } from "@/lib/auth-api";

export type StaffDashboardPayload = {
  staff: {
    id: number;
    name: string;
    photo_url: string | null;
    availability_status: string;
    commission_percent: number | string | null;
  };
  shop: { id: number; name: string; slug: string } | null;
  today_appointment_count: number;
  today_commission_cents_estimate: number;
  next_appointment: {
    id: number;
    customer_name: string;
    starts_at: string;
    service: { name: string | null | undefined };
  } | null;
};

export type StaffBookingRow = {
  id: number;
  customer_name: string;
  customer_mobile: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string | null;
  review?: {
    id: number;
    rating: number;
    comment: string | null;
    owner_reply: string | null;
    created_at: string | null;
  } | null;
  service: {
    id: number;
    name: string;
    duration_minutes: number;
    price_cents?: number | null;
  };
  staff: { id: number; name: string };
};

export type StaffSchedulePayload = {
  weekly_schedule: unknown;
  shop_business_hours: unknown;
  shop_holidays: unknown;
  leave_requests: { id: number; date: string; reason: string; status: string; manager_note: string | null }[];
  availability_blocks: { id: number; starts_at: string; ends_at: string; kind: string; note: string | null }[];
};

export type StaffCustomerRow = {
  customer_mobile: string;
  customer_name: string;
  visit_count: number;
  last_visit_at: string;
};

export type StaffServiceInventoryLine = {
  inventory_item_id: number | null;
  name: string;
  sku: string | null;
  unit: string;
  quantity_on_hand: string;
  low_stock_threshold: string | null;
  quantity_per_service: number;
  staff_note: string | null;
  material_cost_cents: number | null;
  cost_price_cents: number | null;
  projected_material_cents: number | null;
  is_low_stock: boolean;
};

export type StaffServiceRow = {
  id: number;
  name: string;
  category: string | null;
  description: string | null;
  duration_minutes: number;
  buffer_after_minutes?: number | null;
  price_cents: number | null;
  staff_notes?: string | null;
  aftercare?: string | null;
  requires_patch_test?: boolean;
  consultation_first?: boolean;
  min_notice_hours?: number;
  online_bookable?: boolean;
  deposit_cents?: number | null;
  audience?: string;
  inventory_lines: StaffServiceInventoryLine[];
  materials_total_cents: number | null;
  smart_hints: string[];
};

export type StaffEarningsSummary = {
  commission_percent: number | string | null;
  range: { from: string; to: string; total_commission_cents: number };
  this_week_commission_cents_estimate: number;
  this_month_commission_cents_estimate: number;
  breakdown: {
    booking_id: number;
    starts_at: string;
    customer_name: string;
    service_name: string | null | undefined;
    price_cents: number;
    commission_cents: number;
    commission_status: string;
  }[];
};

export type StaffNotificationRow = {
  id: number;
  type: string;
  title: string | null;
  body: string | null;
  metadata: unknown;
  is_read: boolean;
  created_at: string | null;
};

export type StaffProfilePayload = {
  id: number;
  shop_id: number;
  name: string;
  bio: string | null;
  photo_url: string | null;
  work_mobile: string | null;
  email: string | null;
  specialties: string[];
  shop: { id: number; name: string; slug: string; is_active?: boolean } | null;
  commission_percent: number | string | null;
  availability_status: string;
  portal_settings: Record<string, unknown>;
};

export type StaffReviewPayload = {
  average_rating: number | null;
  count: number;
  reviews: { id: number; rating: number; comment: string | null; created_at: string | null }[];
};

export type StaffCustomerRiskProfile = {
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

export async function fetchStaffDashboard(
  accessToken: string
): Promise<{ ok: true; data: StaffDashboardPayload } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffDashboardPayload }>("/staff/dashboard", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffAppointments(
  accessToken: string,
  opts?: { from?: string; to?: string; status?: string }
): Promise<{ ok: true; data: StaffBookingRow[] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  if (opts?.status) q.set("status", opts.status);
  const qs = q.toString();
  const res = await authJson<{ data: StaffBookingRow[] }>(`/staff/appointments${qs ? `?${qs}` : ""}`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchStaffAppointment(
  accessToken: string,
  bookingId: number,
  body: { status: string; notes?: string | null }
): Promise<{ ok: true; data: StaffBookingRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffBookingRow }>(`/staff/appointments/${bookingId}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function postStaffRescheduleRequest(
  accessToken: string,
  bookingId: number,
  body: { message: string; suggested_starts_at?: string }
): Promise<{ ok: true; data: StaffBookingRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffBookingRow }>(`/staff/appointments/${bookingId}/reschedule-request`, {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffSchedule(
  accessToken: string
): Promise<{ ok: true; data: StaffSchedulePayload } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffSchedulePayload }>("/staff/schedule", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffLeaveRequests(
  accessToken: string
): Promise<{ ok: true; data: StaffSchedulePayload["leave_requests"] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffSchedulePayload["leave_requests"] }>("/staff/leave-requests", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function createStaffLeaveRequest(
  accessToken: string,
  body: { date: string; reason: string }
): Promise<{ ok: true; data: { id: number; date: string; reason: string; status: string } } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: { id: number; date: string; reason: string; status: string } }>("/staff/leave-requests", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffCustomers(
  accessToken: string
): Promise<{ ok: true; data: StaffCustomerRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffCustomerRow[] }>("/staff/customers", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffCustomerHistory(
  accessToken: string,
  mobile: string
): Promise<{ ok: true; data: unknown[] } | { ok: false; body: ApiErrorBody }> {
  const enc = encodeURIComponent(mobile);
  const res = await authJson<{ data: unknown[] }>(`/staff/customers/${enc}/history`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffCustomerNotes(
  accessToken: string,
  mobile: string
): Promise<{ ok: true; data: { id: number; note: string; created_at: string | null }[] } | { ok: false; body: ApiErrorBody }> {
  const enc = encodeURIComponent(mobile);
  const res = await authJson<{ data: { id: number; note: string; created_at: string | null }[] }>(`/staff/customers/${enc}/notes`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function postStaffCustomerNote(
  accessToken: string,
  body: { customer_mobile: string; note: string }
): Promise<{ ok: true; data: unknown } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: unknown }>("/staff/customer-notes", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffServices(
  accessToken: string
): Promise<{ ok: true; data: StaffServiceRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffServiceRow[] }>("/staff/services", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffEarningsSummary(
  accessToken: string,
  opts?: { from?: string; to?: string }
): Promise<{ ok: true; data: StaffEarningsSummary } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  const qs = q.toString();
  const res = await authJson<{ data: StaffEarningsSummary }>(`/staff/earnings/summary${qs ? `?${qs}` : ""}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffNotifications(
  accessToken: string
): Promise<{ ok: true; data: StaffNotificationRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffNotificationRow[] }>("/staff/notifications", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchStaffNotificationRead(accessToken: string, id: number): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/staff/notifications/${id}/read`, { method: "PATCH", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function postStaffNotificationsReadAll(accessToken: string): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/staff/notifications/read-all", { method: "POST", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function deleteStaffNotificationsAll(accessToken: string): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/staff/notifications", { method: "DELETE", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function patchStaffNotificationPreferences(
  accessToken: string,
  body: { email_alerts?: boolean; sms_alerts?: boolean }
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: Record<string, unknown> }>("/staff/notification-preferences", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffAvailability(
  accessToken: string
): Promise<{ ok: true; data: { availability_status: string } } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: { availability_status: string } }>("/staff/availability", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchStaffAvailabilityStatus(
  accessToken: string,
  availability_status: string
): Promise<{ ok: true; data: { availability_status: string } } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: { availability_status: string } }>("/staff/availability", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ availability_status }),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffAvailabilityBlocks(
  accessToken: string,
  opts?: { from?: string; to?: string }
): Promise<{ ok: true; data: StaffSchedulePayload["availability_blocks"] } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  const qs = q.toString();
  const res = await authJson<{ data: StaffSchedulePayload["availability_blocks"] }>(`/staff/availability/blocks${qs ? `?${qs}` : ""}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function postStaffAvailabilityBlock(
  accessToken: string,
  body: { starts_at: string; ends_at: string; note?: string | null; kind?: string }
): Promise<{ ok: true; data: { id: number; starts_at: string; ends_at: string } } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: { id: number; starts_at: string; ends_at: string } }>("/staff/availability/blocks", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function deleteStaffAvailabilityBlock(
  accessToken: string,
  blockId: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/staff/availability/blocks/${blockId}`, { method: "DELETE", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function fetchStaffReviews(
  accessToken: string,
  opts?: { rating?: number }
): Promise<{ ok: true; data: StaffReviewPayload } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.rating != null) q.set("rating", String(opts.rating));
  const qs = q.toString();
  const res = await authJson<{ data: StaffReviewPayload }>(`/staff/reviews${qs ? `?${qs}` : ""}`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffCustomerRiskProfile(
  accessToken: string,
  mobile: string
): Promise<{ ok: true; data: StaffCustomerRiskProfile } | { ok: false; body: ApiErrorBody }> {
  const enc = encodeURIComponent(mobile);
  const res = await authJson<{ data: StaffCustomerRiskProfile }>(`/staff/customers/${enc}/profile`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchStaffProfile(
  accessToken: string
): Promise<{ ok: true; data: StaffProfilePayload } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffProfilePayload }>("/staff/profile", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchStaffProfile(
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: StaffProfilePayload } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: StaffProfilePayload }>("/staff/profile", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function postAuthChangePassword(
  accessToken: string,
  body: { current_password: string; password: string; password_confirmation: string }
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ message?: string }>("/auth/change-password", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}
