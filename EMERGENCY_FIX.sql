-- ============================================================
-- NUCLEAR EMERGENCY FIX: Login broken after bad RLS policies
-- Run this COMPLETE script in Supabase SQL Editor
-- Paste ALL of it, then click Run
-- ============================================================

-- ============================================================
-- STEP 1: Drop EVERY policy I created (and any conflicting ones)
-- ============================================================
DROP POLICY IF EXISTS "admin_read_users" ON users;
DROP POLICY IF EXISTS "admin_read_orders" ON orders;
DROP POLICY IF EXISTS "admin_read_order_items" ON order_items;
DROP POLICY IF EXISTS "admin_read_invoices" ON invoices;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_admin_all" ON users;
DROP POLICY IF EXISTS "orders_admin_all" ON orders;
DROP POLICY IF EXISTS "orders_select_own" ON orders;
DROP POLICY IF EXISTS "order_items_admin_all" ON order_items;
DROP POLICY IF EXISTS "invoices_admin_all" ON invoices;

-- ============================================================
-- STEP 2: Restore users table - ANY authenticated user can read
-- This is the CRITICAL fix - login needs to read users table
-- ============================================================
CREATE POLICY "users_auth_select"
    ON users FOR SELECT
    USING (auth.role() = 'authenticated');

-- Admin can still do everything on users
CREATE POLICY "users_admin_all"
    ON users FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- ============================================================
-- STEP 3: Restore orders table
-- ============================================================
CREATE POLICY "orders_auth_select"
    ON orders FOR SELECT
    USING (auth.role() = 'authenticated');

-- Admin can do everything on orders
CREATE POLICY "orders_admin_all"
    ON orders FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- ============================================================
-- STEP 4: Restore order_items table
-- ============================================================
CREATE POLICY "order_items_auth_select"
    ON order_items FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "order_items_admin_all"
    ON order_items FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- ============================================================
-- STEP 5: Restore invoices table
-- ============================================================
CREATE POLICY "invoices_auth_select"
    ON invoices FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "invoices_admin_all"
    ON invoices FOR ALL
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- ============================================================
-- STEP 6: Recreate RPC functions (these bypass RLS for dashboard)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_orders()
RETURNS SETOF orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT * FROM orders ORDER BY created_at DESC; $$;

GRANT EXECUTE ON FUNCTION get_all_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_orders() TO anon;

CREATE OR REPLACE FUNCTION get_all_order_items()
RETURNS SETOF order_items
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT * FROM order_items ORDER BY created_at DESC; $$;

GRANT EXECUTE ON FUNCTION get_all_order_items() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_order_items() TO anon;

CREATE OR REPLACE FUNCTION get_all_invoices()
RETURNS SETOF invoices
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT * FROM invoices ORDER BY created_at DESC; $$;

GRANT EXECUTE ON FUNCTION get_all_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_invoices() TO anon;

CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$ SELECT * FROM users ORDER BY created_at DESC; $$;

GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users() TO anon;

-- Done. Login should work for ALL users now.
