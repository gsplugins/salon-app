-- Canonical schema snapshot. Versioned copy: supabase/migrations/*_initial_schema.sql (use `npm run db:push` after `supabase link`).

create extension if not exists pgcrypto;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  mobile text not null unique,
  password_hash text not null,
  role text not null default 'customer' check (role in ('customer','shop_owner','barber','staff','super_admin')),
  is_locked boolean not null default false,
  loyalty_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table users add column if not exists photo_url text;

create table if not exists shops (
  id bigserial primary key,
  owner_user_id uuid references users(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  is_active boolean not null default true,
  settings jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists shop_members (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  shop_id bigint not null references shops(id) on delete cascade,
  role text not null check (role in ('owner','manager','barber')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, shop_id)
);

create table if not exists subscriptions (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  plan_key text not null default 'starter',
  status text not null default 'trialing',
  trial_ends_at timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id)
);

create table if not exists refresh_tokens (
  id bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_refresh_tokens_user on refresh_tokens(user_id);
create index if not exists idx_shop_members_shop on shop_members(shop_id);

alter table shops add column if not exists phone text;
alter table shops add column if not exists email text;
alter table shops add column if not exists address text;
alter table shops add column if not exists latitude text;
alter table shops add column if not exists longitude text;
alter table shops add column if not exists photos jsonb;

create table if not exists salon_services (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  name text not null,
  category text,
  duration_minutes integer not null default 30,
  buffer_after_minutes integer not null default 0,
  price_cents integer,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists salon_staff (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  name text not null,
  bio text,
  photo_url text,
  specialties jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists salon_staff_services (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  staff_id bigint not null references salon_staff(id) on delete cascade,
  service_id bigint not null references salon_services(id) on delete cascade,
  unique (staff_id, service_id)
);

create table if not exists salon_bookings (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  salon_service_id bigint not null references salon_services(id) on delete restrict,
  salon_staff_id bigint not null references salon_staff(id) on delete restrict,
  customer_name text not null,
  customer_mobile text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'confirmed',
  source text not null default 'web',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists queue_entries (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  customer_name text not null,
  customer_mobile text,
  position integer not null,
  status text not null default 'waiting',
  staff_id bigint references salon_staff(id) on delete set null,
  estimated_wait_minutes integer,
  join_time timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_services_shop on salon_services(shop_id);
create index if not exists idx_staff_shop on salon_staff(shop_id);
create unique index if not exists uq_staff_user_single_shop on salon_staff(user_id) where user_id is not null;
create index if not exists idx_bookings_shop on salon_bookings(shop_id);
create index if not exists idx_queue_shop_status on queue_entries(shop_id, status);

alter table shops add column if not exists parent_shop_id bigint references shops(id) on delete set null;

alter table salon_staff add column if not exists position_title text;
alter table salon_staff add column if not exists staff_role text;
alter table salon_staff add column if not exists address text;
alter table salon_staff add column if not exists age integer;
alter table salon_staff add column if not exists experience_years integer;
alter table salon_staff add column if not exists work_mobile text;
alter table salon_staff add column if not exists emergency_contact_name text;
alter table salon_staff add column if not exists emergency_contact_phone text;

alter table queue_entries add column if not exists customer_user_id uuid references users(id) on delete set null;

create table if not exists salon_blocked_slots (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  salon_staff_id bigint references salon_staff(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  kind text not null default 'other',
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_blocked_shop on salon_blocked_slots(shop_id);

create table if not exists inventory_items (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  name text not null,
  quantity numeric(12,2) not null default 0,
  unit text not null default 'unit',
  low_stock_threshold numeric(12,2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists salon_payments (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  salon_booking_id bigint references salon_bookings(id) on delete set null,
  method text not null,
  amount_cents integer not null,
  currency text not null default 'BDT',
  transaction_id text,
  status text not null default 'pending',
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists salon_reviews (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  salon_staff_id bigint references salon_staff(id) on delete set null,
  salon_booking_id bigint references salon_bookings(id) on delete set null,
  customer_user_id uuid references users(id) on delete set null,
  rating smallint not null,
  comment text,
  owner_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reviews_shop on salon_reviews(shop_id);
create unique index if not exists uq_review_booking_customer on salon_reviews(salon_booking_id, customer_user_id);

alter table salon_staff add column if not exists commission_percent numeric(5,2);
alter table salon_staff add column if not exists availability_status text not null default 'available';
alter table salon_staff add column if not exists portal_settings jsonb not null default '{}'::jsonb;
alter table salon_staff add column if not exists email text;
alter table salon_staff add column if not exists weekly_schedule jsonb;

alter table salon_services add column if not exists description text;
alter table salon_services add column if not exists audience text not null default 'all'
  check (audience in ('all', 'men', 'women', 'kids'));
alter table salon_services add column if not exists staff_notes text;
alter table salon_services add column if not exists aftercare text;
alter table salon_services add column if not exists requires_patch_test boolean not null default false;
alter table salon_services add column if not exists consultation_first boolean not null default false;
alter table salon_services add column if not exists min_notice_hours integer not null default 0
  check (min_notice_hours >= 0 and min_notice_hours <= 720);
alter table salon_services add column if not exists online_bookable boolean not null default true;
alter table salon_services add column if not exists deposit_cents integer
  check (deposit_cents is null or (deposit_cents >= 0 and deposit_cents <= 100000000));
alter table salon_blocked_slots add column if not exists note text;
alter table salon_bookings add column if not exists customer_user_id uuid references users(id) on delete set null;

create table if not exists staff_leave_requests (
  id bigserial primary key,
  salon_staff_id bigint not null references salon_staff(id) on delete cascade,
  date date not null,
  reason text not null,
  status text not null default 'pending',
  manager_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists staff_customer_notes (
  id bigserial primary key,
  salon_staff_id bigint not null references salon_staff(id) on delete cascade,
  customer_mobile text not null,
  note text not null,
  created_at timestamptz not null default now()
);

create table if not exists shop_customer_controls (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  customer_mobile text not null,
  is_suspended boolean not null default false,
  is_removed boolean not null default false,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, customer_mobile)
);

create table if not exists shop_customers (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  customer_mobile text not null,
  customer_user_id uuid references users(id) on delete set null,
  customer_name text,
  customer_type text not null default 'regular' check (customer_type in ('regular', 'other')),
  source text not null default 'manual' check (source in ('manual', 'booking', 'import')),
  added_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, customer_mobile)
);

create table if not exists staff_notifications (
  id bigserial primary key,
  salon_staff_id bigint not null references salon_staff(id) on delete cascade,
  type text not null default 'system',
  title text,
  body text,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists customer_notifications (
  id bigserial primary key,
  customer_user_id uuid references users(id) on delete set null,
  customer_mobile text,
  shop_id bigint references shops(id) on delete cascade,
  salon_booking_id bigint references salon_bookings(id) on delete set null,
  type text not null default 'system',
  title text,
  body text,
  metadata jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_leave_staff on staff_leave_requests(salon_staff_id, date);
create index if not exists idx_notes_staff on staff_customer_notes(salon_staff_id, customer_mobile);
create index if not exists idx_shop_customer_controls_shop on shop_customer_controls(shop_id, customer_mobile);
create index if not exists idx_shop_customers_shop_created on shop_customers(shop_id, created_at desc);
create index if not exists idx_shop_customers_shop_mobile on shop_customers(shop_id, customer_mobile);
create index if not exists idx_shop_customers_user on shop_customers(customer_user_id) where customer_user_id is not null;
create index if not exists idx_shop_customers_shop_type on shop_customers(shop_id, customer_type);
create index if not exists idx_notif_staff on staff_notifications(salon_staff_id, created_at);
create index if not exists idx_notif_customer_user on customer_notifications(customer_user_id, created_at);
create index if not exists idx_notif_customer_mobile on customer_notifications(customer_mobile, created_at);

create table if not exists platform_general (
  id bigserial primary key,
  platform_name text not null default 'Salon Platform',
  logo_url text,
  favicon_url text,
  default_locale text not null default 'en',
  default_timezone text not null default 'Asia/Dhaka',
  maintenance_mode boolean not null default false,
  support_email text,
  support_phone text,
  support_info text,
  email_notifications_enabled boolean not null default true,
  sms_notifications_enabled boolean not null default true,
  integrations jsonb not null default '{}'::jsonb,
  role_permissions jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists subscription_plans (
  id bigserial primary key,
  slug text not null unique,
  name text not null,
  description text,
  price_cents integer not null default 0,
  currency text not null default 'BDT',
  billing_cycle text not null default 'monthly',
  trial_days integer not null default 14,
  features jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists notification_templates (
  id bigserial primary key,
  template_key text not null,
  channel text not null,
  subject text,
  body text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists admin_webhooks (
  id bigserial primary key,
  url text not null,
  secret text,
  events jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id bigserial primary key,
  admin_user_id uuid references users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  ip text,
  created_at timestamptz not null default now()
);
alter table audit_logs add column if not exists metadata jsonb;

create table if not exists bkash_payments (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  amount_paisa integer not null,
  trx_id text,
  status text not null default 'completed',
  payer_mobile text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into platform_general (id)
select 1
where not exists (select 1 from platform_general where id = 1);

insert into subscription_plans (slug, name, description, price_cents, currency, billing_cycle, trial_days, features, is_active, sort_order)
select 'starter', 'Starter', 'Default starter plan', 0, 'BDT', 'monthly', 14, '{}'::jsonb, true, 0
where not exists (select 1 from subscription_plans where slug = 'starter');

create table if not exists password_reset_otps (
  id bigserial primary key,
  mobile text not null,
  otp_hash text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_otps_mobile on password_reset_otps(mobile);

-- Booking cart + advance (see migrations/20260423210000_booking_line_items_advance.sql)
alter table salon_bookings add column if not exists line_items jsonb not null default '[]'::jsonb;
alter table salon_bookings add column if not exists total_price_cents integer;
alter table salon_bookings add column if not exists advance_percent_snapshot smallint not null default 0;
alter table salon_bookings add column if not exists advance_amount_cents integer not null default 0;
alter table salon_bookings add column if not exists advance_paid_cents integer not null default 0;

-- High-scale performance additions (keep in sync with migrations/*).
create table if not exists booking_line_items (
  id bigserial primary key,
  booking_id bigint not null references salon_bookings(id) on delete cascade,
  shop_id bigint not null references shops(id) on delete cascade,
  salon_service_id bigint references salon_services(id) on delete set null,
  item_name text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_cents integer not null default 0 check (unit_price_cents >= 0),
  total_price_cents integer not null default 0 check (total_price_cents >= 0),
  duration_minutes integer check (duration_minutes is null or duration_minutes > 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_booking_line_items_booking on booking_line_items(booking_id);
create index if not exists idx_booking_line_items_shop_created on booking_line_items(shop_id, created_at desc);

create index if not exists idx_shops_owner on shops(owner_user_id);
create index if not exists idx_shops_parent on shops(parent_shop_id);
create index if not exists idx_users_role_created on users(role, created_at desc);
create index if not exists idx_shop_members_shop_role_active on shop_members(shop_id, role, is_active);
create index if not exists idx_shop_members_user_active on shop_members(user_id, is_active);
create index if not exists idx_subscriptions_status_period on subscriptions(status, current_period_end);

create index if not exists idx_refresh_tokens_user_active_exp
  on refresh_tokens(user_id, expires_at desc)
  where revoked_at is null;

create index if not exists idx_services_shop_active_sort on salon_services(shop_id, is_active, sort_order, id);
create index if not exists idx_salon_services_shop_online on salon_services(shop_id, online_bookable) where is_active = true;
create index if not exists idx_staff_shop_active_sort on salon_staff(shop_id, is_active, sort_order, id);
create index if not exists idx_staff_user_active on salon_staff(user_id, is_active) where user_id is not null;
create index if not exists idx_staff_services_shop_staff on salon_staff_services(shop_id, staff_id);
create index if not exists idx_staff_services_shop_service on salon_staff_services(shop_id, service_id);

create index if not exists idx_bookings_shop_starts_desc on salon_bookings(shop_id, starts_at desc);
create index if not exists idx_bookings_staff_starts_desc on salon_bookings(salon_staff_id, starts_at desc);
create index if not exists idx_bookings_shop_staff_starts on salon_bookings(shop_id, salon_staff_id, starts_at);
create index if not exists idx_bookings_shop_status_starts on salon_bookings(shop_id, status, starts_at);
create index if not exists idx_bookings_customer_user_starts on salon_bookings(customer_user_id, starts_at desc) where customer_user_id is not null;
create index if not exists idx_bookings_mobile_starts on salon_bookings(customer_mobile, starts_at desc);

create index if not exists idx_queue_shop_status_position on queue_entries(shop_id, status, position);
create index if not exists idx_queue_staff_status on queue_entries(staff_id, status) where staff_id is not null;
create index if not exists idx_queue_customer_user_active on queue_entries(customer_user_id, created_at desc) where customer_user_id is not null;

create index if not exists idx_blocked_slots_shop_staff_starts on salon_blocked_slots(shop_id, salon_staff_id, starts_at);
create index if not exists idx_blocked_slots_staff_starts on salon_blocked_slots(salon_staff_id, starts_at) where salon_staff_id is not null;

create index if not exists idx_payments_shop_created on salon_payments(shop_id, created_at desc);
create index if not exists idx_payments_booking on salon_payments(salon_booking_id) where salon_booking_id is not null;
create index if not exists idx_payments_status_created on salon_payments(status, created_at desc);

create index if not exists idx_reviews_shop_created on salon_reviews(shop_id, created_at desc);
create index if not exists idx_reviews_staff_created on salon_reviews(salon_staff_id, created_at desc) where salon_staff_id is not null;
create index if not exists idx_reviews_customer_created on salon_reviews(customer_user_id, created_at desc) where customer_user_id is not null;

create index if not exists idx_leave_staff_status_date on staff_leave_requests(salon_staff_id, status, date);
create index if not exists idx_notifications_staff_unread_created on staff_notifications(salon_staff_id, is_read, created_at desc);
create index if not exists idx_notifications_customer_user_unread_created
  on customer_notifications(customer_user_id, is_read, created_at desc)
  where customer_user_id is not null;
create index if not exists idx_notifications_customer_mobile_unread_created
  on customer_notifications(customer_mobile, is_read, created_at desc)
  where customer_mobile is not null;
create index if not exists idx_audit_logs_admin_created on audit_logs(admin_user_id, created_at desc);
create index if not exists idx_audit_logs_action_created on audit_logs(action, created_at desc);
create index if not exists idx_bkash_shop_created on bkash_payments(shop_id, created_at desc);

-- Inventory products + per-service materials (see migrations/20260425140000_inventory_products_and_service_materials.sql).
alter table inventory_items add column if not exists sku text;
alter table inventory_items add column if not exists cost_price_cents integer
  check (cost_price_cents is null or (cost_price_cents >= 0 and cost_price_cents <= 100000000));
alter table inventory_items add column if not exists supplier_notes text;

create table if not exists salon_service_inventory (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  salon_service_id bigint not null references salon_services(id) on delete cascade,
  inventory_item_id bigint not null references inventory_items(id) on delete cascade,
  quantity_per_service numeric(12, 4) not null default 1
    check (quantity_per_service > 0 and quantity_per_service <= 100000),
  staff_note text,
  material_cost_cents integer
    check (material_cost_cents is null or (material_cost_cents >= 0 and material_cost_cents <= 100000000)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (salon_service_id, inventory_item_id)
);

create index if not exists idx_service_inventory_service on salon_service_inventory(salon_service_id);
create index if not exists idx_service_inventory_shop on salon_service_inventory(shop_id);
create index if not exists idx_service_inventory_item on salon_service_inventory(inventory_item_id);
