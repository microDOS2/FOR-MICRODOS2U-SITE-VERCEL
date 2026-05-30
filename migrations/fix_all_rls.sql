-- ============================================================
-- EMERGENCY RLS FIX - Broad policies for all portals
-- ============================================================

-- Enable RLS on all tables (idempotent - safe to re-run)
alter table if exists public.users enable row level security;
alter table if exists public.orders enable row level security;
alter table if exists public.invoices enable row level security;
alter table if exists public.order_items enable row level security;
alter table if exists public.commission_payments enable row level security;
alter table if exists public.commission_rules enable row level security;
alter table if exists public.user_commission_overrides enable row level security;
alter table if exists public.rep_account_assignments enable row level security;

-- Drop ALL policies on users
do $$ declare p record; begin for p in (select policyname from pg_policies where tablename = 'users' and schemaname = 'public') loop execute format('drop policy %I on public.users', p.policyname); end loop; end $$;

-- Drop ALL policies on orders
do $$ declare p record; begin for p in (select policyname from pg_policies where tablename = 'orders' and schemaname = 'public') loop execute format('drop policy %I on public.orders', p.policyname); end loop; end $$;

-- Drop ALL policies on invoices
do $$ declare p record; begin for p in (select policyname from pg_policies where tablename = 'invoices' and schemaname = 'public') loop execute format('drop policy %I on public.invoices', p.policyname); end loop; end $$;

-- Drop ALL policies on order_items
do $$ declare p record; begin for p in (select policyname from pg_policies where tablename = 'order_items' and schemaname = 'public') loop execute format('drop policy %I on public.order_items', p.policyname); end loop; end $$;

-- Drop ALL policies on commission_payments
do $$ declare p record; begin for p in (select policyname from pg_policies where tablename = 'commission_payments' and schemaname = 'public') loop execute format('drop policy %I on public.commission_payments', p.policyname); end loop; end $$;

-- Drop ALL policies on commission_rules
do $$ declare p record; begin for p in (select policyname from pg_policies where tablename = 'commission_rules' and schemaname = 'public') loop execute format('drop policy %I on public.commission_rules', p.policyname); end loop; end $$;

-- Drop ALL policies on user_commission_overrides
do $$ declare p record; begin for p in (select policyname from pg_policies where tablename = 'user_commission_overrides' and schemaname = 'public') loop execute format('drop policy %I on public.user_commission_overrides', p.policyname); end loop; end $$;

-- Drop ALL policies on rep_account_assignments
do $$ declare p record; begin for p in (select policyname from pg_policies where tablename = 'rep_account_assignments' and schemaname = 'public') loop execute format('drop policy %I on public.rep_account_assignments', p.policyname); end loop; end $$;

-- ============================================================
-- CREATE SIMPLE POLICIES
-- ============================================================

-- USERS: All authenticated users can read (needed for cross-referencing)
create policy "users_select" on public.users for select to authenticated using (true);
create policy "users_update_own" on public.users for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ORDERS: Users read own, reps read assigned accounts, managers read territory
create policy "orders_select_own" on public.orders for select to authenticated using (user_id = auth.uid());
create policy "orders_select_rep" on public.orders for select to authenticated using (
  exists (select 1 from public.rep_account_assignments where account_id = orders.user_id and rep_id = auth.uid())
);
create policy "orders_select_mgr" on public.orders for select to authenticated using (
  exists (select 1 from public.users where id = orders.user_id and manager_id = auth.uid())
);

-- INVOICES: Same pattern
create policy "invoices_select_own" on public.invoices for select to authenticated using (user_id = auth.uid());
create policy "invoices_select_rep" on public.invoices for select to authenticated using (
  exists (select 1 from public.orders join public.rep_account_assignments on account_id = orders.user_id
    where orders.id = invoices.order_id and rep_id = auth.uid())
);
create policy "invoices_select_mgr" on public.invoices for select to authenticated using (
  exists (select 1 from public.orders join public.users on users.id = orders.user_id
    where orders.id = invoices.order_id and manager_id = auth.uid())
);

-- ORDER ITEMS: Read via parent order
create policy "order_items_select" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders where id = order_items.order_id and (
    user_id = auth.uid()
    or exists (select 1 from public.rep_account_assignments where account_id = orders.user_id and rep_id = auth.uid())
    or exists (select 1 from public.users where id = orders.user_id and manager_id = auth.uid())
  ))
);

-- COMMISSION PAYMENTS: Read own only
create policy "commissions_select_own" on public.commission_payments for select to authenticated using (user_id = auth.uid());

-- COMMISSION RULES: All authenticated can read
create policy "commission_rules_select" on public.commission_rules for select to authenticated using (true);

-- USER COMMISSION OVERRIDES: Read own
create policy "overrides_select_own" on public.user_commission_overrides for select to authenticated using (user_id = auth.uid());

-- REP ACCOUNT ASSIGNMENTS: Own or manager
create policy "rep_assigns_select_own" on public.rep_account_assignments for select to authenticated using (rep_id = auth.uid());
create policy "rep_assigns_select_mgr" on public.rep_account_assignments for select to authenticated using (
  exists (select 1 from public.users where id = rep_account_assignments.rep_id and manager_id = auth.uid())
);
