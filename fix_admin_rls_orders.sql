-- ============================================================
-- FIX: Allow admin to read orders and users (RLS policies)
-- Run this in your Supabase SQL Editor NOW
-- ============================================================

-- 1. Admin can read ALL orders
DROP POLICY IF EXISTS "admin_read_orders" ON orders;
CREATE POLICY "admin_read_orders"
    ON orders FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 2. Admin can read ALL users
DROP POLICY IF EXISTS "admin_read_users" ON users;
CREATE POLICY "admin_read_users"
    ON users FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 3. Admin can read ALL order_items
DROP POLICY IF EXISTS "admin_read_order_items" ON order_items;
CREATE POLICY "admin_read_order_items"
    ON order_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 4. Admin can read ALL invoices
DROP POLICY IF EXISTS "admin_read_invoices" ON invoices;
CREATE POLICY "admin_read_invoices"
    ON invoices FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
    ));

-- 5. RPC function to get all orders (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_orders()
RETURNS SETOF orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM orders ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_all_orders() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_orders() TO anon;

-- 6. RPC function to get all order_items (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_order_items()
RETURNS SETOF order_items
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM order_items ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_all_order_items() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_order_items() TO anon;

-- 7. RPC function to get all invoices (bypasses RLS)
CREATE OR REPLACE FUNCTION get_all_invoices()
RETURNS SETOF invoices
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM invoices ORDER BY created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_all_invoices() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_invoices() TO anon;

-- Done! Admin can now read all data.
