-- ============================================================
-- SECURITY DEFINER functions for Sales Rep / Manager portals
-- These bypass RLS entirely, solving the 400 Bad Request issue
-- caused by nested RLS subquery evaluation
-- ============================================================

-- Drop existing functions
drop function if exists public.get_rep_orders(uuid);
drop function if exists public.get_rep_invoices(uuid);
drop function if exists public.get_rep_commissions(uuid);
drop function if exists public.get_manager_orders(uuid);
drop function if exists public.get_manager_invoices(uuid);
drop function if exists public.get_manager_commissions(uuid);

-- ============================================================
-- SALES REP: Get orders for assigned accounts
-- ============================================================
create or replace function public.get_rep_orders(p_rep_id uuid)
returns table (
  id uuid,
  user_id uuid,
  po_number text,
  quantity numeric,
  total_amount numeric,
  status text,
  shipping_address text,
  contact_person text,
  contact_phone text,
  payment_method text,
  created_at timestamptz,
  account_name text,
  account_email text
)
language sql
security definer
stable
as $$
  select 
    o.id,
    o.user_id,
    o.po_number,
    o.quantity,
    o.total_amount,
    o.status,
    o.shipping_address,
    o.contact_person,
    o.contact_phone,
    o.payment_method,
    o.created_at,
    u.business_name as account_name,
    u.email as account_email
  from public.orders o
  join public.users u on u.id = o.user_id
  where o.user_id in (
    -- Direct account assignments
    select account_id from public.rep_account_assignments where rep_id = p_rep_id
    union
    -- Store-based assignments
    select user_id from public.wholesaler_store_locations 
    where license_number like 'rep:' || p_rep_id::text || '%'
  )
  order by o.created_at desc
  limit 500;
$$;

-- ============================================================
-- SALES REP: Get invoices for assigned accounts
-- ============================================================
create or replace function public.get_rep_invoices(p_rep_id uuid)
returns table (
  id uuid,
  user_id uuid,
  order_id uuid,
  invoice_number text,
  amount numeric,
  status text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz,
  account_name text,
  account_email text
)
language sql
security definer
stable
as $$
  select 
    i.id,
    i.user_id,
    i.order_id,
    i.invoice_number,
    i.amount,
    i.status,
    i.due_date,
    i.paid_at,
    i.created_at,
    u.business_name as account_name,
    u.email as account_email
  from public.invoices i
  join public.users u on u.id = i.user_id
  where i.user_id in (
    select account_id from public.rep_account_assignments where rep_id = p_rep_id
    union
    select user_id from public.wholesaler_store_locations 
    where license_number like 'rep:' || p_rep_id::text || '%'
  )
  order by i.created_at desc
  limit 500;
$$;

-- ============================================================
-- SALES REP: Get commissions
-- ============================================================
create or replace function public.get_rep_commissions(p_rep_id uuid)
returns table (
  id uuid,
  order_id uuid,
  order_amount numeric,
  amount numeric,
  rate_percent numeric,
  account_type text,
  period_year integer,
  period_month integer,
  status text,
  paid_at timestamptz,
  paid_method text,
  created_at timestamptz,
  account_name text
)
language sql
security definer
stable
as $$
  select 
    cp.id,
    cp.order_id,
    o.total as order_amount,
    cp.amount,
    cp.rate_percent,
    cp.account_type,
    cp.period_year,
    cp.period_month,
    cp.status,
    cp.paid_at,
    cp.paid_method,
    cp.created_at,
    u.business_name as account_name
  from public.commission_payments cp
  left join public.orders o on o.id = cp.order_id
  left join public.users u on u.id = cp.account_id
  where cp.user_id = p_rep_id
  order by cp.created_at desc
  limit 500;
$$;

-- ============================================================
-- SALES MANAGER: Get orders for territory accounts
-- ============================================================
create or replace function public.get_manager_orders(p_manager_id uuid)
returns table (
  id uuid,
  user_id uuid,
  po_number text,
  quantity numeric,
  total_amount numeric,
  status text,
  shipping_address text,
  contact_person text,
  contact_phone text,
  payment_method text,
  created_at timestamptz,
  account_name text,
  account_email text
)
language sql
security definer
stable
as $$
  select 
    o.id,
    o.user_id,
    o.po_number,
    o.quantity,
    o.total_amount,
    o.status,
    o.shipping_address,
    o.contact_person,
    o.contact_phone,
    o.payment_method,
    o.created_at,
    u.business_name as account_name,
    u.email as account_email
  from public.orders o
  join public.users u on u.id = o.user_id
  where u.manager_id = p_manager_id
  order by o.created_at desc
  limit 500;
$$;

-- ============================================================
-- SALES MANAGER: Get invoices for territory accounts
-- ============================================================
create or replace function public.get_manager_invoices(p_manager_id uuid)
returns table (
  id uuid,
  user_id uuid,
  order_id uuid,
  invoice_number text,
  amount numeric,
  status text,
  due_date date,
  paid_at timestamptz,
  created_at timestamptz,
  account_name text,
  account_email text
)
language sql
security definer
stable
as $$
  select 
    i.id,
    i.user_id,
    i.order_id,
    i.invoice_number,
    i.amount,
    i.status,
    i.due_date,
    i.paid_at,
    i.created_at,
    u.business_name as account_name,
    u.email as account_email
  from public.invoices i
  join public.users u on u.id = i.user_id
  where u.manager_id = p_manager_id
  order by i.created_at desc
  limit 500;
$$;

-- ============================================================
-- SALES MANAGER: Get commissions for self (manager override)
-- ============================================================
create or replace function public.get_manager_commissions(p_manager_id uuid)
returns table (
  id uuid,
  order_id uuid,
  order_amount numeric,
  amount numeric,
  rate_percent numeric,
  account_type text,
  period_year integer,
  period_month integer,
  status text,
  paid_at timestamptz,
  paid_method text,
  created_at timestamptz,
  account_name text
)
language sql
security definer
stable
as $$
  select 
    cp.id,
    cp.order_id,
    o.total as order_amount,
    cp.amount,
    cp.rate_percent,
    cp.account_type,
    cp.period_year,
    cp.period_month,
    cp.status,
    cp.paid_at,
    cp.paid_method,
    cp.created_at,
    u.business_name as account_name
  from public.commission_payments cp
  left join public.orders o on o.id = cp.order_id
  left join public.users u on u.id = cp.account_id
  where cp.user_id = p_manager_id
  order by cp.created_at desc
  limit 500;
$$;
