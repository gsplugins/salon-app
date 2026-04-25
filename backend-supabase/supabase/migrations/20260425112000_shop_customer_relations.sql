-- Explicit customer-to-shop relation so managers can add customers before first booking.
create table if not exists shop_customers (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  customer_mobile text not null,
  customer_user_id uuid references users(id) on delete set null,
  customer_name text,
  source text not null default 'manual' check (source in ('manual', 'booking', 'import')),
  added_by_user_id uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, customer_mobile)
);
create index if not exists idx_shop_customers_shop_created on shop_customers(shop_id, created_at desc);
create index if not exists idx_shop_customers_shop_mobile on shop_customers(shop_id, customer_mobile);
create index if not exists idx_shop_customers_user on shop_customers(customer_user_id) where customer_user_id is not null;
