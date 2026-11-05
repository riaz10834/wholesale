-- Run once in the Supabase SQL editor. Safe to run again.
-- Your own message is removed for both people.
-- The other person's message is hidden only on your screen.

drop policy if exists order_messages_delete on public.order_messages;
create policy order_messages_delete on public.order_messages
  for delete using (sender_id = auth.uid() or public.is_admin());

grant delete on public.order_messages to authenticated;

create table if not exists public.order_message_hides (
  message_id uuid not null references public.order_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.order_message_hides enable row level security;

drop policy if exists order_message_hides_own on public.order_message_hides;
create policy order_message_hides_own on public.order_message_hides
  for select using (user_id = auth.uid());

drop policy if exists order_message_hides_insert on public.order_message_hides;
create policy order_message_hides_insert on public.order_message_hides
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.order_messages m
      where m.id = message_id
        and m.sender_id <> auth.uid()
        and (public.owns_order(m.order_id) or public.is_assigned_to_order(m.order_id) or public.is_admin())
    )
  );

grant select, insert on public.order_message_hides to authenticated;

alter table public.order_messages replica identity full;
