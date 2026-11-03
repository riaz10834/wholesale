-- Run this once in Supabase SQL Editor if the project was created before
-- the dispatch-location table existed. Safe to run more than once.

create table if not exists public.store_settings (
  id int primary key default 1 check (id = 1),
  warehouse_name text not null default 'Warehouse',
  warehouse_address text,
  warehouse_lat double precision,
  warehouse_lng double precision,
  updated_at timestamptz not null default now()
);

insert into public.store_settings (id) values (1) on conflict (id) do nothing;

alter table public.store_settings enable row level security;

drop policy if exists store_settings_read on public.store_settings;
create policy store_settings_read on public.store_settings for select using (true);

drop policy if exists store_settings_admin_insert on public.store_settings;
create policy store_settings_admin_insert on public.store_settings
  for insert with check (public.is_admin());

drop policy if exists store_settings_admin_update on public.store_settings;
create policy store_settings_admin_update on public.store_settings
  for update using (public.is_admin()) with check (public.is_admin());

grant select on public.store_settings to anon, authenticated;
grant insert, update on public.store_settings to authenticated;
