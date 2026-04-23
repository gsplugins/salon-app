-- Minimal bootstrap seed for backend-supabase
-- Run after schema.sql

-- 1) Super admin (replace hash/mobile for production)
-- Password for this seed row: Admin@12345  (bcrypt cost 10, verified against bcryptjs)
insert into users (id, name, mobile, password_hash, role, is_locked)
select
  gen_random_uuid(),
  'Platform Super Admin',
  '+8801711111111',
  '$2a$10$6vczW0EDbtpXIywPOT32HuoX6Jt1rzoRSXHWmQoMHGBkPgR8JR7DO',
  'super_admin',
  false
where not exists (
  select 1 from users where role = 'super_admin'
);

-- 2) Ensure platform general singleton
insert into platform_general (id, platform_name, default_locale, default_timezone, integrations)
select 1, 'Salon Platform', 'en', 'Asia/Dhaka', '{}'::jsonb
where not exists (select 1 from platform_general where id = 1);

-- 3) Default subscription plans
insert into subscription_plans (slug, name, description, price_cents, currency, billing_cycle, trial_days, features, is_active, sort_order)
select 'pro', 'Pro', 'Professional plan', 199900, 'BDT', 'monthly', 7, '{"staff_limit": 20}'::jsonb, true, 10
where not exists (select 1 from subscription_plans where slug = 'pro');

insert into subscription_plans (slug, name, description, price_cents, currency, billing_cycle, trial_days, features, is_active, sort_order)
select 'business', 'Business', 'Business scale plan', 499900, 'BDT', 'monthly', 7, '{"staff_limit": 100}'::jsonb, true, 20
where not exists (select 1 from subscription_plans where slug = 'business');

-- 4) Notification templates used by admin UI
insert into notification_templates (template_key, channel, subject, body, is_active)
select 'booking_confirmation', 'sms', null, 'Your booking is confirmed.', true
where not exists (
  select 1 from notification_templates where template_key = 'booking_confirmation' and channel = 'sms'
);

insert into notification_templates (template_key, channel, subject, body, is_active)
select 'booking_confirmation', 'email', 'Booking confirmed', 'Your booking is confirmed.', true
where not exists (
  select 1 from notification_templates where template_key = 'booking_confirmation' and channel = 'email'
);

insert into notification_templates (template_key, channel, subject, body, is_active)
select 'booking_reminder', 'sms', null, 'Reminder: your appointment is coming up.', true
where not exists (
  select 1 from notification_templates where template_key = 'booking_reminder' and channel = 'sms'
);
