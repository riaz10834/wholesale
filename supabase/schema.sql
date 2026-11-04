-- =====================================================================
-- Wholesale B2B Ecommerce & Delivery Management - Supabase schema
-- Run this whole file once in Supabase Dashboard -> SQL Editor.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
do $$ begin
  create type user_role as enum ('customer', 'admin', 'delivery');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_status as enum (
    'pending','confirmed','preparing','packed','out_for_delivery',
    'delivered','cancelled','failed','returned');
exception when duplicate_object then null; end $$;

do $$ begin
  create type delivery_status as enum ('assigned','picked_up','out_for_delivery','delivered','failed','cancelled');
exception when duplicate_object then null; end $$;

do $$ begin
  create type payment_status as enum ('unpaid','partial','paid','refunded');
exception when duplicate_object then null; end $$;

-- ---------- Users (profiles) ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  phone text not null default '',
  role user_role not null default 'customer',
  is_active boolean not null default true,
  -- live tracking (delivery persons)
  is_online boolean not null default false,
  last_lat double precision,
  last_lng double precision,
  last_accuracy double precision,
  last_heading double precision,
  last_speed double precision,
  last_location_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Customers ----------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references public.profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  shop_name text,
  address text,
  lat double precision,
  lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Catalog ----------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.categories(id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  unit text not null default 'pcs',
  wholesale_price numeric(12,2) not null check (wholesale_price >= 0),
  retail_price numeric(12,2) check (retail_price >= 0),
  cost_price numeric(12,2) not null default 0 check (cost_price >= 0),
  min_order_qty int not null default 1 check (min_order_qty >= 1),
  images text[] not null default '{}',
  is_featured boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_name_idx on public.products using gin (to_tsvector('simple', name));

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  sku text unique,
  size text,
  color text,
  color_hex text,
  price numeric(12,2) check (price >= 0),       -- null => product wholesale price
  cost_price numeric(12,2) check (cost_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists variants_product_idx on public.product_variants(product_id);

create table if not exists public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  quantity int not null default 0 check (quantity >= 0),
  low_stock_threshold int not null default 10,
  updated_at timestamptz not null default now()
);

-- ---------- Orders ----------
create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique default ('ORD-' || nextval('public.order_number_seq')::text),
  user_id uuid not null references public.profiles(id) on delete restrict,
  customer_id uuid references public.customers(id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  shop_name text,
  address text,
  lat double precision not null,
  lng double precision not null,
  notes text,
  status order_status not null default 'pending',
  payment_method text not null default 'cod',
  payment_status payment_status not null default 'unpaid',
  subtotal numeric(12,2) not null default 0,
  delivery_fee numeric(12,2) not null default 0,
  discount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  total_cost numeric(12,2) not null default 0,
  cancel_reason text,
  confirmed_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_idx on public.orders(user_id);
create index if not exists orders_status_idx on public.orders(status);
create index if not exists orders_created_idx on public.orders(created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  size text,
  color text,
  image_url text,
  quantity int not null check (quantity > 0),
  unit_price numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0,
  line_total numeric(12,2) not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);

create table if not exists public.order_status_history (
  id bigserial primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  status order_status not null,
  note text,
  changed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists osh_order_idx on public.order_status_history(order_id);

-- ---------- Deliveries ----------
create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  delivery_person_id uuid not null references public.profiles(id) on delete restrict,
  status delivery_status not null default 'assigned',
  assigned_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  failure_reason text,
  notes text,
  cash_collected numeric(12,2) not null default 0
);
create index if not exists deliveries_person_idx on public.deliveries(delivery_person_id);

create table if not exists public.delivery_locations (
  id bigserial primary key,
  delivery_person_id uuid not null references public.profiles(id) on delete cascade,
  delivery_id uuid references public.deliveries(id) on delete set null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  accuracy double precision,
  heading double precision,
  speed double precision,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists dl_person_idx on public.delivery_locations(delivery_person_id, created_at desc);

-- ---------- Finance ----------
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'cash',
  reference text,
  received_by uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);
create index if not exists payments_order_idx on public.payments(order_id);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric(12,2) not null check (amount > 0),
  description text,
  expense_date date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- =====================================================================
-- Helper functions
-- =====================================================================
create or replace function public.current_role_name() returns user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and is_active);
$$;

create or replace function public.is_delivery() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'delivery' and is_active);
$$;

-- Is the given delivery person currently delivering an order of the calling customer?
create or replace function public.is_my_active_courier(p_person uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from public.deliveries d
    join public.orders o on o.id = d.order_id
    where d.delivery_person_id = p_person
      and o.user_id = auth.uid()
      and o.status = 'out_for_delivery'
  );
$$;

create or replace function public.is_assigned_to_order(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.deliveries d where d.order_id = p_order and d.delivery_person_id = auth.uid());
$$;

create or replace function public.owns_order(p_order uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.orders o where o.id = p_order and o.user_id = auth.uid());
$$;

-- =====================================================================
-- Auth trigger: create a profile for every new user (always 'customer'
-- unless created through the admin API with app_metadata.role)
-- =====================================================================
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role user_role := 'customer';
begin
  if (new.raw_app_meta_data ->> 'role') in ('delivery','admin') then
    v_role := (new.raw_app_meta_data ->> 'role')::user_role;
  end if;
  insert into public.profiles (id, email, full_name, phone, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    v_role
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent non-admins from changing role / active / tracking fields directly
create or replace function public.protect_profile_fields() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() or auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    raise exception 'Not allowed to change role or status';
  end if;
  return new;
end $$;

drop trigger if exists protect_profile on public.profiles;
create trigger protect_profile before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- updated_at helper
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products for each row execute function public.touch_updated_at();
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();
drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();
drop trigger if exists inventory_touch on public.inventory;
create trigger inventory_touch before update on public.inventory for each row execute function public.touch_updated_at();

-- Auto-create inventory row for every variant
create or replace function public.create_inventory_row() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.inventory (variant_id, quantity) values (new.id, 0) on conflict do nothing;
  return new;
end $$;
drop trigger if exists variant_inventory on public.product_variants;
create trigger variant_inventory after insert on public.product_variants
  for each row execute function public.create_inventory_row();

-- =====================================================================
-- Place order (atomic: validates MOQ, stock, computes prices server-side)
-- p_items: [{"variant_id": "...", "quantity": 10}, ...]
-- =====================================================================
create or replace function public.place_order(
  p_items jsonb,
  p_name text,
  p_phone text,
  p_shop_name text,
  p_address text,
  p_lat double precision,
  p_lng double precision,
  p_notes text default null,
  p_payment_method text default 'cod'
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_customer_id uuid;
  v_order_id uuid;
  v_item jsonb;
  v_qty int;
  v_variant record;
  v_subtotal numeric(12,2) := 0;
  v_cost numeric(12,2) := 0;
  v_price numeric(12,2);
  v_unit_cost numeric(12,2);
begin
  if v_uid is null then raise exception 'Please log in to place an order'; end if;
  if coalesce(trim(p_name), '') = '' or length(p_name) > 120 then raise exception 'Valid name is required'; end if;
  if p_phone !~ '^\+?[0-9 \-]{7,20}$' then raise exception 'Valid mobile number is required'; end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'Delivery location is required';
  end if;
  if p_payment_method not in ('cod','bank_transfer','credit') then raise exception 'Invalid payment method'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Cart is empty'; end if;
  if jsonb_array_length(p_items) > 200 then raise exception 'Too many items'; end if;

  insert into public.customers (user_id, name, phone, shop_name, address, lat, lng)
  values (v_uid, trim(p_name), trim(p_phone), nullif(trim(coalesce(p_shop_name,'')), ''), p_address, p_lat, p_lng)
  on conflict (user_id) do update set
    name = excluded.name, phone = excluded.phone, shop_name = excluded.shop_name,
    address = excluded.address, lat = excluded.lat, lng = excluded.lng
  returning id into v_customer_id;

  insert into public.orders (user_id, customer_id, customer_name, customer_phone, shop_name, address, lat, lng, notes, payment_method)
  values (v_uid, v_customer_id, trim(p_name), trim(p_phone), nullif(trim(coalesce(p_shop_name,'')), ''), p_address, p_lat, p_lng,
          nullif(left(coalesce(p_notes,''), 1000), ''), p_payment_method)
  returning id into v_order_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := (v_item ->> 'quantity')::int;
    if v_qty is null or v_qty <= 0 then raise exception 'Invalid quantity'; end if;

    select v.id, v.size, v.color, v.price, v.cost_price, v.is_active as v_active,
           p.id as product_id, p.name, p.wholesale_price, p.cost_price as p_cost, p.min_order_qty,
           p.is_active as p_active, p.images, i.quantity as stock
      into v_variant
      from public.product_variants v
      join public.products p on p.id = v.product_id
      join public.inventory i on i.variant_id = v.id
     where v.id = (v_item ->> 'variant_id')::uuid
     for update of i;

    if not found or not v_variant.v_active or not v_variant.p_active then
      raise exception 'A product in your cart is no longer available';
    end if;
    if v_qty < v_variant.min_order_qty then
      raise exception 'Minimum order quantity for % is %', v_variant.name, v_variant.min_order_qty;
    end if;
    if v_variant.stock < v_qty then
      raise exception 'Only % in stock for % %', v_variant.stock, v_variant.name,
        coalesce(nullif(concat_ws(' / ', v_variant.size, v_variant.color), ''), '');
    end if;

    v_price := coalesce(v_variant.price, v_variant.wholesale_price);
    v_unit_cost := coalesce(v_variant.cost_price, v_variant.p_cost, 0);

    insert into public.order_items (order_id, product_id, variant_id, product_name, size, color, image_url,
                                    quantity, unit_price, unit_cost, line_total)
    values (v_order_id, v_variant.product_id, v_variant.id, v_variant.name, v_variant.size, v_variant.color,
            v_variant.images[1], v_qty, v_price, v_unit_cost, v_price * v_qty);

    update public.inventory set quantity = quantity - v_qty where variant_id = v_variant.id;

    v_subtotal := v_subtotal + v_price * v_qty;
    v_cost := v_cost + v_unit_cost * v_qty;
  end loop;

  update public.orders set subtotal = v_subtotal, total = v_subtotal, total_cost = v_cost where id = v_order_id;
  insert into public.order_status_history (order_id, status, changed_by) values (v_order_id, 'pending', v_uid);

  insert into public.notifications (user_id, title, body, link)
  select id, 'New order received', trim(p_name) || ' placed an order', '/admin/orders/' || v_order_id
  from public.profiles where role = 'admin' and is_active;

  return v_order_id;
end $$;

-- Customer can cancel own order while pending
create or replace function public.cancel_my_order(p_order_id uuid, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status = 'cancelled', cancel_reason = left(coalesce(p_reason, 'Cancelled by customer'), 500)
  where id = p_order_id and user_id = auth.uid() and status = 'pending';
  if not found then raise exception 'Order can no longer be cancelled'; end if;
end $$;

-- =====================================================================
-- Order status change side effects
-- =====================================================================
create or replace function public.on_order_status_change() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_label text;
begin
  if new.status is distinct from old.status then
    -- restore stock when cancelled/returned
    if new.status in ('cancelled','returned') and old.status not in ('cancelled','returned') then
      update public.inventory i set quantity = i.quantity + oi.quantity
      from public.order_items oi where oi.order_id = new.id and oi.variant_id = i.variant_id;
    end if;
    if new.status = 'confirmed' and new.confirmed_at is null then new.confirmed_at := now(); end if;
    if new.status = 'delivered' then new.delivered_at := now(); end if;

    insert into public.order_status_history (order_id, status, changed_by) values (new.id, new.status, auth.uid());

    v_label := replace(initcap(replace(new.status::text, '_', ' ')), 'For', 'for');
    insert into public.notifications (user_id, title, body, link)
    values (new.user_id, 'Order ' || new.order_number || ': ' || v_label,
            'Your order status is now ' || v_label, '/orders/' || new.id);

    -- keep delivery record in sync for terminal admin actions
    if new.status in ('cancelled','returned') then
      update public.deliveries set status = 'cancelled', completed_at = coalesce(completed_at, now())
      where order_id = new.id and status not in ('delivered','failed');
    end if;
  end if;
  return new;
end $$;

drop trigger if exists order_status_change on public.orders;
create trigger order_status_change before update on public.orders
  for each row execute function public.on_order_status_change();

-- Payment status recalculation
create or replace function public.recalc_payment_status() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_order uuid := coalesce(new.order_id, old.order_id);
  v_paid numeric(12,2);
  v_total numeric(12,2);
begin
  select coalesce(sum(amount),0) into v_paid from public.payments where order_id = v_order;
  select total into v_total from public.orders where id = v_order;
  update public.orders set payment_status =
    case when v_paid <= 0 then 'unpaid'::payment_status
         when v_paid < v_total then 'partial'::payment_status
         else 'paid'::payment_status end
  where id = v_order;
  return null;
end $$;

drop trigger if exists payments_recalc on public.payments;
create trigger payments_recalc after insert or update or delete on public.payments
  for each row execute function public.recalc_payment_status();

-- =====================================================================
-- Admin: assign delivery person
-- =====================================================================
create or replace function public.assign_delivery(p_order_id uuid, p_person_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_num text;
begin
  if not public.is_admin() then raise exception 'Admin only'; end if;
  if not exists(select 1 from public.profiles where id = p_person_id and role = 'delivery' and is_active) then
    raise exception 'Invalid delivery person';
  end if;
  select order_number into v_num from public.orders
   where id = p_order_id and status not in ('delivered','cancelled','returned');
  if not found then raise exception 'Order cannot be assigned'; end if;

  insert into public.deliveries (order_id, delivery_person_id, status, assigned_at)
  values (p_order_id, p_person_id, 'assigned', now())
  on conflict (order_id) do update set delivery_person_id = excluded.delivery_person_id,
    status = 'assigned', assigned_at = now(), started_at = null, completed_at = null, failure_reason = null
  returning id into v_id;

  insert into public.notifications (user_id, title, body, link)
  values (p_person_id, 'New delivery assigned', 'Order ' || v_num || ' has been assigned to you', '/delivery/orders/' || v_id);
  return v_id;
end $$;

-- =====================================================================
-- Delivery person: update delivery status
-- =====================================================================
create or replace function public.update_delivery_status(
  p_delivery_id uuid, p_status delivery_status, p_note text default null, p_cash numeric default 0
) returns void
language plpgsql security definer set search_path = public as $$
declare
  d record;
begin
  select * into d from public.deliveries where id = p_delivery_id for update;
  if not found then raise exception 'Delivery not found'; end if;
  if d.delivery_person_id <> auth.uid() and not public.is_admin() then raise exception 'Not your delivery'; end if;
  if d.status in ('delivered','failed','cancelled') then raise exception 'Delivery already closed'; end if;
  if p_status = 'failed' and coalesce(trim(p_note),'') = '' then raise exception 'Please give a reason for failed delivery'; end if;
  if coalesce(p_cash,0) < 0 then raise exception 'Invalid amount'; end if;

  update public.deliveries set
    status = p_status,
    started_at = case when p_status in ('picked_up','out_for_delivery') then coalesce(started_at, now()) else started_at end,
    completed_at = case when p_status in ('delivered','failed') then now() else completed_at end,
    failure_reason = case when p_status = 'failed' then left(p_note, 500) else failure_reason end,
    notes = case when p_status <> 'failed' and p_note is not null then left(p_note, 500) else notes end,
    cash_collected = case when p_status = 'delivered' then coalesce(p_cash,0) else cash_collected end
  where id = p_delivery_id;

  update public.orders set status = case p_status
      when 'picked_up' then 'out_for_delivery'::order_status
      when 'out_for_delivery' then 'out_for_delivery'::order_status
      when 'delivered' then 'delivered'::order_status
      when 'failed' then 'failed'::order_status
      else status end
  where id = d.order_id;

  if p_status = 'delivered' and coalesce(p_cash,0) > 0 then
    insert into public.payments (order_id, amount, method, received_by, notes)
    values (d.order_id, p_cash, 'cash', auth.uid(), 'Collected on delivery');
  end if;
end $$;

-- =====================================================================
-- Delivery person: push GPS location (also used to go online/offline)
-- =====================================================================
create or replace function public.push_location(
  p_lat double precision, p_lng double precision,
  p_accuracy double precision default null, p_heading double precision default null,
  p_speed double precision default null, p_recorded_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_delivery uuid;
begin
  if not public.is_delivery() then raise exception 'Delivery persons only'; end if;
  if p_lat not between -90 and 90 or p_lng not between -180 and 180 then raise exception 'Invalid coordinates'; end if;

  select d.id into v_delivery from public.deliveries d
   where d.delivery_person_id = auth.uid() and d.status in ('picked_up','out_for_delivery')
   order by d.started_at desc nulls last limit 1;

  insert into public.delivery_locations (delivery_person_id, delivery_id, lat, lng, accuracy, heading, speed, recorded_at)
  values (auth.uid(), v_delivery, p_lat, p_lng, p_accuracy, p_heading, p_speed, coalesce(p_recorded_at, now()));

  update public.profiles set is_online = true, last_lat = p_lat, last_lng = p_lng, last_accuracy = p_accuracy,
    last_heading = p_heading, last_speed = p_speed, last_location_at = now()
  where id = auth.uid();
end $$;

create or replace function public.set_online(p_online boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_delivery() then raise exception 'Delivery persons only'; end if;
  update public.profiles set is_online = p_online where id = auth.uid();
end $$;

-- =====================================================================
-- Row Level Security
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.customers enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.deliveries enable row level security;
alter table public.delivery_locations enable row level security;
alter table public.payments enable row level security;
alter table public.expenses enable row level security;
alter table public.notifications enable row level security;

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select using (
  id = auth.uid() or public.is_admin() or (role = 'delivery' and public.is_my_active_courier(id))
);
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_admin_all on public.profiles;
create policy profiles_admin_all on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- customers
drop policy if exists customers_own on public.customers;
create policy customers_own on public.customers for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists customers_own_upd on public.customers;
create policy customers_own_upd on public.customers for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists customers_own_ins on public.customers;
create policy customers_own_ins on public.customers for insert with check (user_id = auth.uid());
drop policy if exists customers_admin on public.customers;
create policy customers_admin on public.customers for all using (public.is_admin()) with check (public.is_admin());

-- catalog (public read)
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (is_active or public.is_admin());
drop policy if exists categories_admin on public.categories;
create policy categories_admin on public.categories for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (is_active or public.is_admin());
drop policy if exists products_admin on public.products;
create policy products_admin on public.products for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists variants_read on public.product_variants;
create policy variants_read on public.product_variants for select using (true);
drop policy if exists variants_admin on public.product_variants;
create policy variants_admin on public.product_variants for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists inventory_read on public.inventory;
create policy inventory_read on public.inventory for select using (true);
drop policy if exists inventory_admin on public.inventory;
create policy inventory_admin on public.inventory for all using (public.is_admin()) with check (public.is_admin());

-- orders (inserts only via place_order)
drop policy if exists orders_select on public.orders;
create policy orders_select on public.orders for select using (
  user_id = auth.uid() or public.is_admin() or public.is_assigned_to_order(id)
);
drop policy if exists orders_admin on public.orders;
create policy orders_admin on public.orders for update using (public.is_admin()) with check (public.is_admin());
drop policy if exists orders_admin_del on public.orders;
create policy orders_admin_del on public.orders for delete using (public.is_admin());

drop policy if exists order_items_select on public.order_items;
create policy order_items_select on public.order_items for select using (
  public.owns_order(order_id) or public.is_admin() or public.is_assigned_to_order(order_id)
);
drop policy if exists order_items_admin on public.order_items;
create policy order_items_admin on public.order_items for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists osh_select on public.order_status_history;
create policy osh_select on public.order_status_history for select using (
  public.owns_order(order_id) or public.is_admin() or public.is_assigned_to_order(order_id)
);

-- deliveries
drop policy if exists deliveries_select on public.deliveries;
create policy deliveries_select on public.deliveries for select using (
  delivery_person_id = auth.uid() or public.is_admin() or public.owns_order(order_id)
);
drop policy if exists deliveries_admin on public.deliveries;
create policy deliveries_admin on public.deliveries for all using (public.is_admin()) with check (public.is_admin());

-- delivery locations (inserts only via push_location)
drop policy if exists dl_select on public.delivery_locations;
create policy dl_select on public.delivery_locations for select using (
  delivery_person_id = auth.uid() or public.is_admin() or public.is_my_active_courier(delivery_person_id)
);

-- payments
drop policy if exists payments_select on public.payments;
create policy payments_select on public.payments for select using (
  public.is_admin() or public.owns_order(order_id) or public.is_assigned_to_order(order_id)
);
drop policy if exists payments_admin on public.payments;
create policy payments_admin on public.payments for all using (public.is_admin()) with check (public.is_admin());

-- expenses
drop policy if exists expenses_admin on public.expenses;
create policy expenses_admin on public.expenses for all using (public.is_admin()) with check (public.is_admin());

-- notifications
drop policy if exists notifications_own on public.notifications;
create policy notifications_own on public.notifications for select using (user_id = auth.uid());
drop policy if exists notifications_own_upd on public.notifications;
create policy notifications_own_upd on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists notifications_admin on public.notifications;
create policy notifications_admin on public.notifications for all using (public.is_admin()) with check (public.is_admin());

-- function grants
revoke all on function public.place_order(jsonb,text,text,text,text,double precision,double precision,text,text) from anon;
grant execute on function public.place_order(jsonb,text,text,text,text,double precision,double precision,text,text) to authenticated;
grant execute on function public.cancel_my_order(uuid,text) to authenticated;
grant execute on function public.assign_delivery(uuid,uuid) to authenticated;
grant execute on function public.update_delivery_status(uuid,delivery_status,text,numeric) to authenticated;
grant execute on function public.push_location(double precision,double precision,double precision,double precision,double precision,timestamptz) to authenticated;
grant execute on function public.set_online(boolean) to authenticated;

-- =====================================================================
-- Realtime
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['profiles','orders','deliveries','delivery_locations','notifications'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- =====================================================================
-- Storage bucket for product images
-- =====================================================================
insert into storage.buckets (id, name, public) values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists "product images public read" on storage.objects;
create policy "product images public read" on storage.objects for select using (bucket_id = 'product-images');
drop policy if exists "product images admin write" on storage.objects;
create policy "product images admin write" on storage.objects for insert with check (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product images admin update" on storage.objects;
create policy "product images admin update" on storage.objects for update using (bucket_id = 'product-images' and public.is_admin());
drop policy if exists "product images admin delete" on storage.objects;
create policy "product images admin delete" on storage.objects for delete using (bucket_id = 'product-images' and public.is_admin());

-- =====================================================================
-- Dispatch location: where orders leave from. Customers and admins read it.
-- =====================================================================
create table if not exists public.store_settings (
  id int primary key default 1 check (id = 1),
  warehouse_name text not null default 'Warehouse',
  warehouse_address text,
  warehouse_lat double precision,
  warehouse_lng double precision,
  bank_name text,
  account_title text,
  account_number text,
  iban text,
  branch text,
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

-- =====================================================================
-- After signing up your own account, make it admin:
--   update public.profiles set role = 'admin' where email = 'you@example.com';
-- =====================================================================
