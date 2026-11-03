-- Clears every order, rider assignment, payment, and order notification.
-- Stock taken by those orders is put back, except orders already cancelled or returned
-- (those were restocked when they closed).
-- Run once in Supabase Dashboard -> SQL Editor.

begin;

update public.inventory i
set quantity = i.quantity + x.qty
from (
  select oi.variant_id, sum(oi.quantity)::int as qty
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  where oi.variant_id is not null
    and o.status not in ('cancelled', 'returned')
  group by oi.variant_id
) x
where i.variant_id = x.variant_id;

delete from public.notifications;
delete from public.delivery_locations;
delete from public.orders;

commit;
