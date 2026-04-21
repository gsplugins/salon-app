import { authJson, formatApiError, type ApiErrorBody } from "@/lib/auth-api";

export type PlatformGeneral = {
  id: number;
  platform_name: string;
  logo_url: string | null;
  favicon_url: string | null;
  default_locale: string;
  default_timezone: string;
  maintenance_mode: boolean;
  support_email: string | null;
  support_phone: string | null;
  support_info: string | null;
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;
  integrations: Record<string, unknown>;
  role_permissions: Record<string, unknown> | null;
};

export type SubscriptionPlanRow = {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
  billing_cycle: string;
  trial_days: number;
  features: Record<string, unknown> | null;
  is_active: boolean;
  sort_order: number;
};

export type NotificationTemplateRow = {
  id: number;
  template_key: string;
  channel: string;
  subject: string | null;
  body: string;
  is_active: boolean;
};

export type AdminWebhookRow = {
  id: number;
  url: string;
  secret: string | null;
  events: string[] | null;
  is_active: boolean;
};

export type AuditLogRow = {
  id: number;
  admin_user_id: number | null;
  action: string;
  target_type: string | null;
  target_id: number | null;
  ip: string | null;
  created_at: string;
  admin?: { id: number; name: string; mobile: string } | null;
};

export type Paginated<T> = {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
};

export async function fetchAdminGeneral(
  accessToken: string
): Promise<{ ok: true; data: PlatformGeneral } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: PlatformGeneral }>("/admin/general", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchAdminGeneral(
  accessToken: string,
  body: Partial<
    Pick<
      PlatformGeneral,
      | "platform_name"
      | "logo_url"
      | "favicon_url"
      | "default_locale"
      | "default_timezone"
      | "maintenance_mode"
      | "support_email"
      | "support_phone"
      | "support_info"
      | "email_notifications_enabled"
      | "sms_notifications_enabled"
    >
  >
): Promise<{ ok: true; data: PlatformGeneral } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: PlatformGeneral }>("/admin/general", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchSubscriptionPlans(
  accessToken: string
): Promise<{ ok: true; data: SubscriptionPlanRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: SubscriptionPlanRow[] }>("/admin/subscription-plans", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function postSubscriptionPlan(
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: SubscriptionPlanRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: SubscriptionPlanRow }>("/admin/subscription-plans", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchSubscriptionPlan(
  accessToken: string,
  id: number,
  body: Record<string, unknown>
): Promise<{ ok: true; data: SubscriptionPlanRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: SubscriptionPlanRow }>(`/admin/subscription-plans/${id}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function deleteSubscriptionPlan(
  accessToken: string,
  id: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/admin/subscription-plans/${id}`, { method: "DELETE", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function patchShopSubscriptionPlan(
  accessToken: string,
  shopId: number,
  subscription_plan_id: number
): Promise<{ ok: true; data: unknown } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/admin/shops/${shopId}/subscription`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify({ subscription_plan_id }),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function fetchAdminAuditLogs(
  accessToken: string,
  opts?: { page?: number; from?: string; to?: string; action?: string }
): Promise<{ ok: true; data: Paginated<AuditLogRow> } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.page && opts.page > 1) q.set("page", String(opts.page));
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  if (opts?.action) q.set("action", opts.action);
  const qs = q.toString();
  const res = await authJson<Paginated<AuditLogRow>>(`/admin/audit-logs${qs ? `?${qs}` : ""}`, { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export function adminAuditLogsExportUrl(opts?: { from?: string; to?: string }): string {
  const q = new URLSearchParams();
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  const qs = q.toString();
  return `/api/admin/audit-logs/export${qs ? `?${qs}` : ""}`;
}

export async function fetchNotificationTemplates(
  accessToken: string
): Promise<{ ok: true; data: NotificationTemplateRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: NotificationTemplateRow[] }>("/admin/notification-templates", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchNotificationTemplate(
  accessToken: string,
  id: number,
  body: { subject?: string | null; body?: string; is_active?: boolean }
): Promise<{ ok: true; data: NotificationTemplateRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: NotificationTemplateRow }>(`/admin/notification-templates/${id}`, {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchAdminSmtp(
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/admin/integrations/smtp", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function patchAdminSms(
  accessToken: string,
  body: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/admin/integrations/sms", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function patchNotificationToggles(
  accessToken: string,
  body: { email_notifications_enabled?: boolean; sms_notifications_enabled?: boolean }
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/admin/notification-toggles", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function fetchAdminIntegrations(
  accessToken: string
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: Record<string, unknown> }>("/admin/integrations", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function patchAdminStripe(
  accessToken: string,
  body: Record<string, string | null>
): Promise<{ ok: true; data: unknown } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/admin/integrations/stripe", {
    method: "PATCH",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function fetchAdminWebhooks(
  accessToken: string
): Promise<{ ok: true; data: AdminWebhookRow[] } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: AdminWebhookRow[] }>("/admin/webhooks", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function postAdminWebhook(
  accessToken: string,
  body: { url: string; secret?: string | null; events?: string[]; is_active?: boolean }
): Promise<{ ok: true; data: AdminWebhookRow } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: AdminWebhookRow }>("/admin/webhooks", {
    method: "POST",
    accessToken,
    body: JSON.stringify(body),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function deleteAdminWebhook(
  accessToken: string,
  id: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/admin/webhooks/${id}`, { method: "DELETE", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function fetchAdminAnalyticsSummary(
  accessToken: string
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: Record<string, unknown> }>("/admin/analytics/summary", { accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function fetchAdminPermissions(
  accessToken: string
): Promise<{ ok: true; data: { matrix: Record<string, Record<string, boolean>>; overrides: unknown } } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson<{ data: { matrix: Record<string, Record<string, boolean>>; overrides: unknown } }>("/admin/permissions", {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data.data };
}

export async function putAdminPermissions(
  accessToken: string,
  role_permissions: Record<string, unknown>
): Promise<{ ok: true; data: unknown } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson("/admin/permissions", {
    method: "PUT",
    accessToken,
    body: JSON.stringify({ role_permissions }),
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function postImpersonateUser(
  accessToken: string,
  userId: number
): Promise<
  | { ok: true; data: { access_token: string; refresh_token: string; expires_in: number } }
  | { ok: false; body: ApiErrorBody }
> {
  const res = await authJson<{ access_token: string; refresh_token: string; expires_in: number }>(
    `/admin/users/${userId}/impersonate`,
    { method: "POST", accessToken }
  );
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function deleteAdminUser(
  accessToken: string,
  userId: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/admin/users/${userId}`, { method: "DELETE", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function fetchBillingBkash(
  accessToken: string,
  opts?: { page?: number; shop_id?: number; status?: string; from?: string; to?: string }
): Promise<{ ok: true; data: Paginated<Record<string, unknown>> } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.page && opts.page > 1) q.set("page", String(opts.page));
  if (opts?.shop_id) q.set("shop_id", String(opts.shop_id));
  if (opts?.status) q.set("status", opts.status);
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  const qs = q.toString();
  const res = await authJson<Paginated<Record<string, unknown>>>(`/admin/billing/bkash${qs ? `?${qs}` : ""}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function fetchBillingSalon(
  accessToken: string,
  opts?: { page?: number; shop_id?: number; status?: string; from?: string; to?: string }
): Promise<{ ok: true; data: Paginated<Record<string, unknown>> } | { ok: false; body: ApiErrorBody }> {
  const q = new URLSearchParams();
  if (opts?.page && opts.page > 1) q.set("page", String(opts.page));
  if (opts?.shop_id) q.set("shop_id", String(opts.shop_id));
  if (opts?.status) q.set("status", opts.status);
  if (opts?.from) q.set("from", opts.from);
  if (opts?.to) q.set("to", opts.to);
  const qs = q.toString();
  const res = await authJson<Paginated<Record<string, unknown>>>(`/admin/billing/salon-payments${qs ? `?${qs}` : ""}`, {
    accessToken,
  });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true, data: res.data };
}

export async function patchBkashRefund(
  accessToken: string,
  paymentId: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/admin/billing/bkash/${paymentId}/refund`, { method: "PATCH", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export async function patchSalonPaymentRefund(
  accessToken: string,
  id: number
): Promise<{ ok: true } | { ok: false; body: ApiErrorBody }> {
  const res = await authJson(`/admin/billing/salon-payments/${id}/refund`, { method: "PATCH", accessToken });
  if (!res.ok) return { ok: false, body: res.body };
  return { ok: true };
}

export { formatApiError };
