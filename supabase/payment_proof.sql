-- Run once in the Supabase SQL editor. Safe to run more than once.
-- Customer sends a receipt. Admin matches it in their own bank app, then marks it received.

create table if not exists public.payment_proofs (
  order_id uuid primary key references public.orders(id) on delete cascade,
  reference text not null,
  image_base64 text not null,
  status text not null default 'submitted' check (status in ('submitted', 'accepted', 'rejected')),
  reject_reason text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

alter table public.payment_proofs enable row level security;

drop policy if exists payment_proofs_read on public.payment_proofs;
create policy payment_proofs_read on public.payment_proofs
  for select using (public.is_admin() or public.owns_order(order_id));

drop policy if exists payment_proofs_admin_update on public.payment_proofs;
create policy payment_proofs_admin_update on public.payment_proofs
  for update using (public.is_admin()) with check (public.is_admin());

grant select, update on public.payment_proofs to authenticated;

create or replace function public.submit_payment_proof(
  p_order_id uuid,
  p_reference text,
  p_image_base64 text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders;
  v_ref text := trim(coalesce(p_reference, ''));
  v_img text := regexp_replace(coalesce(p_image_base64, ''), '\s', '', 'g');
begin
  if auth.uid() is null then raise exception 'Please log in'; end if;
  if length(v_ref) < 4 or length(v_ref) > 80 then
    raise exception 'Enter the transaction ID from your receipt';
  end if;
  if v_img = '' then raise exception 'Upload the receipt screenshot'; end if;
  if length(v_img) > 1500000 then
    raise exception 'Screenshot is too large. Crop it to the receipt and try again.';
  end if;
  if v_img !~ '^[A-Za-z0-9+/=]+$' then raise exception 'Invalid screenshot'; end if;

  select * into v_order from public.orders where id = p_order_id and user_id = auth.uid();
  if not found then raise exception 'Order not found'; end if;
  if v_order.payment_method <> 'bank_transfer' then raise exception 'This order is not a bank transfer'; end if;
  if v_order.payment_status = 'paid' then raise exception 'This order is already paid'; end if;
  if v_order.status in ('cancelled', 'returned') then raise exception 'This order is closed'; end if;

  if exists (
    select 1 from public.payment_proofs
    where lower(reference) = lower(v_ref) and order_id <> p_order_id and status <> 'rejected'
  ) or exists (
    select 1 from public.payments where lower(coalesce(reference, '')) = lower(v_ref)
  ) then
    raise exception 'This transaction ID was already used';
  end if;

  insert into public.payment_proofs (order_id, reference, image_base64, status, reject_reason, created_at, reviewed_at)
  values (p_order_id, v_ref, v_img, 'submitted', null, now(), null)
  on conflict (order_id) do update set
    reference = excluded.reference,
    image_base64 = excluded.image_base64,
    status = 'submitted',
    reject_reason = null,
    created_at = now(),
    reviewed_at = null;

  insert into public.notifications (user_id, title, body, link)
  select id,
    'Bank transfer to check',
    v_order.customer_name || ' sent a receipt for ' || v_order.order_number || ' (' || v_ref || ')',
    '/admin/orders/' || p_order_id::text
  from public.profiles
  where role = 'admin' and is_active;
end $$;

revoke all on function public.submit_payment_proof(uuid, text, text) from public, anon;
grant execute on function public.submit_payment_proof(uuid, text, text) to authenticated;
