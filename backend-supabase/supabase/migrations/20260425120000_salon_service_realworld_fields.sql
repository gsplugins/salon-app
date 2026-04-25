-- Richer per-service data for day-to-day salon operations (booking rules, client care, staff notes).

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
create index if not exists idx_salon_services_shop_online on salon_services(shop_id, online_bookable) where is_active = true;
