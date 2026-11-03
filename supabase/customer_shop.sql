-- Lets a signed-in customer save or change their shop address from the account page.
-- Safe to run more than once.

drop policy if exists customers_own_ins on public.customers;
create policy customers_own_ins on public.customers for insert with check (user_id = auth.uid());
