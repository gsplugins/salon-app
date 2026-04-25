-- Richer product rows + link products to services (materials / COGS hints for staff).

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
