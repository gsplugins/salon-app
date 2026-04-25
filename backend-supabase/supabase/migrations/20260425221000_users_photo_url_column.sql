-- Ensure user profile photos can be persisted as hosted URLs.
alter table if exists public.users
  add column if not exists photo_url text;
