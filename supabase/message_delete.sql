-- Run once if order chat is already set up. Lets someone delete their own message.

drop policy if exists order_messages_delete on public.order_messages;
create policy order_messages_delete on public.order_messages
  for delete using (sender_id = auth.uid() or public.is_admin());

grant delete on public.order_messages to authenticated;
