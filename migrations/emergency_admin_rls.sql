-- ============================================================
-- EMERGENCY: Admin can't read orders/invoices/commissions
-- Run ALL of this in Supabase SQL Editor
-- ============================================================

-- 1. Drop any partial admin policies that may exist
drop policy if exists "orders_select_admin" on public.orders;
drop policy if exists "invoices_select_admin" on public.invoices;
drop policy if exists "commissions_select_admin" on public.commission_payments;
drop policy if exists "order_items_select_admin" on public.order_items;

-- 2. Create admin policies - admin can read ALL rows
create policy "orders_select_admin" on public.orders
  for select to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "invoices_select_admin" on public.invoices
  for select to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "commissions_select_admin" on public.commission_payments
  for select to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "order_items_select_admin" on public.order_items
  for select to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- 3. Also add update/insert/delete for admin
create policy "orders_admin_all" on public.orders
  for all to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "invoices_admin_all" on public.invoices
  for all to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "order_items_admin_all" on public.order_items
  for all to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "users_admin_all" on public.users
  for all to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "commission_payments_admin_all" on public.commission_payments
  for all to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "commission_rules_admin_all" on public.commission_rules
  for all to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "user_commission_overrides_admin_all" on public.user_commission_overrides
  for all to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

create policy "rep_account_assignments_admin_all" on public.rep_account_assignments
  for all to authenticated using (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  ) with check (
    exists (select 1 from public.users where id = auth.uid() and role = 'admin')
  );

-- 4. Verify: show all policies
select tablename, policyname, cmd 
from pg_policies 
where schemaname = 'public' 
order by tablename, policyname;
