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

alter table salon_staff add column if not exists commission_percent numeric(5,2);
alter table salon_staff add column if not exists availability_status text not null default 'available';
alter table salon_staff add column if not exists portal_settings jsonb not null default '{}'::jsonb;
alter table salon_staff add column if not exists email text;
alter table salon_staff add column if not exists weekly_schedule jsonb;

alter table salon_services add column if not exists description text;
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

create index if not exists idx_leave_staff on staff_leave_requests(salon_staff_id, date);
create index if not exists idx_notes_staff on staff_customer_notes(salon_staff_id, customer_mobile);
create index if not exists idx_notif_staff on staff_notifications(salon_staff_id, created_at);

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
