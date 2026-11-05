-- Run once in the Supabase SQL editor. Safe to run more than once.
-- The customer and the assigned rider can text and send voice notes on an order.

create table if not exists public.order_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('text', 'voice')),
  body text,
  audio_base64 text,
  audio_mime text,
  created_at timestamptz not null default now()
);
create index if not exists order_messages_order_idx on public.order_messages (order_id, created_at);

alter table public.order_messages enable row level security;

drop policy if exists order_messages_read on public.order_messages;
create policy order_messages_read on public.order_messages
  for select using (
    public.owns_order(order_id) or public.is_assigned_to_order(order_id) or public.is_admin()
  );

grant select on public.order_messages to authenticated;

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

create or replace function public.send_order_message(
  p_order_id uuid,
  p_kind text,
  p_body text default null,
  p_audio_base64 text default null,
  p_audio_mime text default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_customer uuid;
  v_number text;
  v_rider uuid;
  v_delivery uuid;
  v_body text;
  v_audio text;
  v_mime text;
  v_id uuid;
  v_other uuid;
  v_link text;
  v_preview text;
begin
  if v_uid is null then raise exception 'Please log in'; end if;
  if p_kind not in ('text', 'voice') then raise exception 'Invalid message'; end if;

  select o.user_id, o.order_number, d.delivery_person_id, d.id
    into v_customer, v_number, v_rider, v_delivery
  from public.orders o
  left join public.deliveries d on d.order_id = o.id
  where o.id = p_order_id;

  if v_customer is null then raise exception 'Order not found'; end if;
  if v_rider is null then raise exception 'A rider is not assigned to this order yet'; end if;
  if v_uid <> v_customer and v_uid <> v_rider then raise exception 'You cannot message on this order'; end if;

  if p_kind = 'text' then
    v_body := trim(coalesce(p_body, ''));
    if length(v_body) < 1 or length(v_body) > 500 then
      raise exception 'Write a message up to 500 characters';
    end if;
    v_audio := null;
    v_mime := null;
    v_preview := left(v_body, 80);
  else
    v_audio := regexp_replace(coalesce(p_audio_base64, ''), '\s', '', 'g');
    if length(v_audio) < 100 or length(v_audio) > 400000 then
      raise exception 'Voice message is too long. Keep it under 30 seconds.';
    end if;
    if v_audio !~ '^[A-Za-z0-9+/=]+$' then raise exception 'Invalid voice message'; end if;
    v_mime := case
      when coalesce(p_audio_mime, '') like 'audio/%' then left(split_part(p_audio_mime, ';', 1), 40)
      else 'audio/webm'
    end;
    v_body := null;
    v_preview := 'Voice message';
  end if;

  insert into public.order_messages (order_id, sender_id, kind, body, audio_base64, audio_mime)
  values (p_order_id, v_uid, p_kind, v_body, v_audio, v_mime)
  returning id into v_id;

  v_other := case when v_uid = v_customer then v_rider else v_customer end;
  v_link := case
    when v_uid = v_customer then '/delivery/orders/' || v_delivery::text
    else '/orders/' || p_order_id::text
  end;

  insert into public.notifications (user_id, title, body, link)
  values (v_other, 'New message on ' || v_number, v_preview, v_link);

  return v_id;
end $$;

revoke all on function public.send_order_message(uuid, text, text, text, text) from public, anon;
grant execute on function public.send_order_message(uuid, text, text, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.order_messages;
exception when duplicate_object then null;
end $$;
