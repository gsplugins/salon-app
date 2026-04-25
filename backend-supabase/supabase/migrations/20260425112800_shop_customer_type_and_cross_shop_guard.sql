-- Add customer type classification for shop-customer relation.
alter table shop_customers
  add column if not exists customer_type text not null default 'regular'
  check (customer_type in ('regular', 'other'));
create index if not exists idx_shop_customers_shop_type on shop_customers(shop_id, customer_type);
