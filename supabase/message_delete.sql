-- Run once in the Supabase SQL editor. Safe to run again.
-- Customer or the assigned rider can delete a message on their order.

drop policy if exists order_messages_delete on public.order_messages;
create policy order_messages_delete on public.order_messages
  for delete using (
    sender_id = auth.uid()
    or public.owns_order(order_id)
    or public.is_assigned_to_order(order_id)
    or public.is_admin()
  );

grant delete on public.order_messages to authenticated;
