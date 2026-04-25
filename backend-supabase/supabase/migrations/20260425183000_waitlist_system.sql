-- Waitlist support for fully-booked days with auto notification on cancellation.

create table if not exists waitlist (
  id bigserial primary key,
  shop_id bigint not null references shops(id) on delete cascade,
  service_id bigint not null references salon_services(id) on delete cascade,
  staff_id bigint references salon_staff(id) on delete set null,
  customer_id uuid references users(id) on delete set null,
  customer_mobile text,
  preferred_date date not null,
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'booked', 'expired', 'cancelled')),
  notified_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_waitlist_lookup on waitlist(shop_id, service_id, preferred_date, status, created_at);
create index if not exists idx_waitlist_customer on waitlist(customer_id, customer_mobile, created_at desc);
create or replace function notify_waitlist_on_booking_cancelled()
returns trigger
language plpgsql
as $$
declare
  candidate record;
  customer_uid uuid;
  customer_phone text;
begin
  if tg_op <> 'UPDATE' then
    return new;
  end if;
  if old.status is not distinct from new.status then
    return new;
  end if;
  if coalesce(lower(new.status), '') <> 'cancelled' then
    return new;
  end if;

  select w.id, w.customer_id, w.customer_mobile
    into candidate
  from waitlist w
  where w.shop_id = new.shop_id
    and w.service_id = new.salon_service_id
    and w.preferred_date = (new.starts_at at time zone 'utc')::date
    and w.status = 'waiting'
    and (w.staff_id is null or w.staff_id = new.salon_staff_id)
  order by w.created_at asc
  limit 1;

  if candidate.id is null then
    return new;
  end if;

  customer_uid := candidate.customer_id;
  customer_phone := candidate.customer_mobile;

  update waitlist
  set status = 'notified',
      notified_at = now()
  where id = candidate.id;

  insert into customer_notifications (
    customer_user_id,
    customer_mobile,
    shop_id,
    salon_booking_id,
    type,
    title,
    body,
    metadata,
    is_read
  )
  values (
    customer_uid,
    customer_phone,
    new.shop_id,
    new.id,
    'waitlist_slot_open',
    'Slot opened up',
    'A booking slot matching your waitlist request is now available. Please book soon.',
    jsonb_build_object(
      'waitlist_id', candidate.id,
      'service_id', new.salon_service_id,
      'staff_id', new.salon_staff_id,
      'preferred_date', (new.starts_at at time zone 'utc')::date
    ),
    false
  );

  return new;
end;
$$;
drop trigger if exists trg_waitlist_booking_cancelled on salon_bookings;
create trigger trg_waitlist_booking_cancelled
after update of status on salon_bookings
for each row
execute function notify_waitlist_on_booking_cancelled();
