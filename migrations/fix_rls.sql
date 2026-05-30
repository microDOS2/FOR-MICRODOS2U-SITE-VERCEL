-- ============================================================
-- FIX RLS - Simple, broad policies that work
-- ============================================================

-- First, disable RLS temporarily so we can verify data exists
-- (comment out the next line if you want to keep RLS on during debugging)
-- ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;

-- Drop ALL existing policies on these tables
drop policy if exists "Users read own profile" on public.users;
drop policy if exists "Users read their accounts" on public.users;
drop policy if exists "Users read manager territory" on public.users;
drop policy if exists "Users read their reps" on public.users;
drop policy if exists "Users read all admin" on public.users;
drop policy if exists "Users read all (admin)" on public.users;
drop policy if exists "Users update own profile" on public.users;
drop policy if exists "Enable read access for all users" on public.users;
drop policy if exists "Enable read access for authenticated users" on public.users;

drop policy if exists "Orders read own" on public.orders;
drop policy if exists "Orders read rep accounts" on public.orders;
drop policy if exists "Orders read manager territory" on public.orders;
drop policy if exists "Orders read admin" on public.orders;
drop policy if exists "Enable read access for authenticated users" on public.orders;

drop policy if exists "Invoices read own" on public.invoices;
drop policy if exists "Invoices read rep accounts" on public.invoices;
drop policy if exists "Invoices read manager territory" on public.invoices;
drop policy if exists "Invoices read admin" on public.invoices;
drop policy if exists "Enable read access for authenticated users" on public.invoices;

drop policy if exists "Order items read via orders" on public.order_items;
drop policy if exists "Enable read access for authenticated users" on public.order_items;

drop policy if exists "Commissions read own" on public.commission_payments;
drop policy if exists "Commissions read admin" on public.commission_payments;
drop policy if exists "Enable read access for authenticated users" on public.commission_payments;

drop policy if exists "Commission rules read all auth" on public.commission_rules;
drop policy if exists "Enable read access for authenticated users" on public.commission_rules;

drop policy if exists "Overrides read own" on public.user_commission_overrides;
drop policy if exists "Enable read access for authenticated users" on public.user_commission_overrides;

drop policy if exists "Rep assignments read own" on public.rep_account_assignments;
drop policy if exists "Rep assignments read manager" on public.rep_account_assignments;
drop policy if exists "Enable read access for authenticated users" on public.rep_account_assignments;

-- ============================================================
-- CREATE NEW POLICIES - Using OR REPLACE for safety
-- ============================================================

-- --- USERS TABLE ---
-- Every authenticated user can read all users (needed for name lookups)
-- This is safe because users table doesn't contain sensitive passwords
create policy "Users read all" on public.users
  for select to authenticated using (true);

create policy "Users update own" on public.users
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- --- ORDERS TABLE ---
-- Users can read their own orders
create policy "Orders read own" on public.orders
  for select to authenticated using (user_id = auth.uid());

-- Reps can read orders from their assigned accounts
create policy "Orders read rep accounts" on public.orders
  for select to authenticated using (
    exists (
      select 1 from public.rep_account_assignments
      where rep_account_assignments.account_id = orders.user_id
      and rep_account_assignments.rep_id = auth.uid()
    )
  );

-- Managers can read orders from their territory accounts
create policy "Orders read manager territory" on public.orders
  for select to authenticated using (
    exists (
      select 1 from public.users
      where users.id = orders.user_id and users.manager_id = auth.uid()
    )
  );

-- --- INVOICES TABLE ---
create policy "Invoices read own" on public.invoices
  for select to authenticated using (user_id = auth.uid());

create policy "Invoices read rep accounts" on public.invoices
  for select to authenticated using (
    exists (
      select 1 from public.orders
      join public.rep_account_assignments on rep_account_assignments.account_id = orders.user_id
      where orders.id = invoices.order_id and rep_account_assignments.rep_id = auth.uid()
    )
  );

create policy "Invoices read manager territory" on public.invoices
  for select to authenticated using (
    exists (
      select 1 from public.orders
      join public.users on users.id = orders.user_id
      where orders.id = invoices.order_id and users.manager_id = auth.uid()
    )
  );

-- --- ORDER ITEMS TABLE ---
create policy "Order items read via orders" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders where orders.id = order_items.order_id and (
        orders.user_id = auth.uid()
        or exists (
          select 1 from public.rep_account_assignments
          where account_id = orders.user_id and rep_id = auth.uid()
        )
        or exists (
          select 1 from public.users where users.id = orders.user_id and users.manager_id = auth.uid()
        )
      )
    )
  );

-- --- COMMISSION PAYMENTS TABLE ---
create policy "Commissions read own" on public.commission_payments
  for select to authenticated using (user_id = auth.uid());

-- --- COMMISSION RULES TABLE ---
create policy "Commission rules read all" on public.commission_rules
  for select to authenticated using (true);

-- --- USER COMMISSION OVERRIDES TABLE ---
create policy "Overrides read own" on public.user_commission_overrides
  for select to authenticated using (user_id = auth.uid());

-- --- REP ACCOUNT ASSIGNMENTS TABLE ---
create policy "Rep assignments read own" on public.rep_account_assignments
  for select to authenticated using (rep_id = auth.uid());

create policy "Rep assignments read manager" on public.rep_account_assignments
  for select to authenticated using (
    exists (
      select 1 from public.users
      where users.id = rep_account_assignments.rep_id and users.manager_id = auth.uid()
    )
  );
