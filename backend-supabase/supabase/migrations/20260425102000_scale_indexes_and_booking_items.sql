-- Performance-focused migration for high-volume future data.
-- Adds stronger indexing patterns and normalizes booking line items.

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
create index if not exists idx_notifications_staff_unread_created
  on staff_notifications(salon_staff_id, is_read, created_at desc);
create index if not exists idx_notifications_customer_user_unread_created
  on customer_notifications(customer_user_id, is_read, created_at desc)
  where customer_user_id is not null;
create index if not exists idx_notifications_customer_mobile_unread_created
  on customer_notifications(customer_mobile, is_read, created_at desc)
  where customer_mobile is not null;
create index if not exists idx_audit_logs_admin_created on audit_logs(admin_user_id, created_at desc);
create index if not exists idx_bkash_shop_created on bkash_payments(shop_id, created_at desc);
