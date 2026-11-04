-- Run once in the Supabase SQL editor. Safe to run more than once.
-- Admin saves these on Bank account. Customers see them when they pay by bank transfer.

alter table public.store_settings
  add column if not exists bank_name text,
  add column if not exists account_title text,
  add column if not exists account_number text,
  add column if not exists iban text,
  add column if not exists branch text;
