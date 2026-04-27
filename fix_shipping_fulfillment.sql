-- ============================================================
-- microDOS(2) Shipping / Fulfillment Portal Schema Update
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add tracking columns to orders table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'tracking_number') THEN
        ALTER TABLE orders ADD COLUMN tracking_number TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'carrier') THEN
        ALTER TABLE orders ADD COLUMN carrier TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'shipped_date') THEN
        ALTER TABLE orders ADD COLUMN shipped_date TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivered_date') THEN
        ALTER TABLE orders ADD COLUMN delivered_date TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'forwarded_to_fulfillment_at') THEN
        ALTER TABLE orders ADD COLUMN forwarded_to_fulfillment_at TIMESTAMPTZ;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'fulfilled_at') THEN
        ALTER TABLE orders ADD COLUMN fulfilled_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. Ensure orders status check constraint includes all statuses
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.constraint_column_usage 
        WHERE table_name = 'orders' AND constraint_name = 'orders_status_check'
    ) THEN
        ALTER TABLE orders DROP CONSTRAINT orders_status_check;
    END IF;
    
    ALTER TABLE orders ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'));
EXCEPTION WHEN OTHERS THEN
    ALTER TABLE orders ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled'));
END $$;

-- 3. RLS Policies for shipping_fulfillment role

-- Orders: SELECT all orders
DROP POLICY IF EXISTS "shipping_read_orders" ON orders;
CREATE POLICY "shipping_read_orders"
    ON orders FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'shipping_fulfillment'
    ));

-- Orders: UPDATE status, tracking, dates
DROP POLICY IF EXISTS "shipping_update_orders" ON orders;
CREATE POLICY "shipping_update_orders"
    ON orders FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'shipping_fulfillment'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'shipping_fulfillment'
    ));

-- Order items: SELECT
DROP POLICY IF EXISTS "shipping_read_order_items" ON order_items;
CREATE POLICY "shipping_read_order_items"
    ON order_items FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'shipping_fulfillment'
    ));

-- Users: SELECT (need business names, addresses)
DROP POLICY IF EXISTS "shipping_read_users" ON users;
CREATE POLICY "shipping_read_users"
    ON users FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'shipping_fulfillment'
    ));

-- Invoices: SELECT
DROP POLICY IF EXISTS "shipping_read_invoices" ON invoices;
CREATE POLICY "shipping_read_invoices"
    ON invoices FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'shipping_fulfillment'
    ));

-- 4. Ensure RLS is enabled
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- 5. Verify
SELECT 'orders columns' as check_item, count(*) as count FROM information_schema.columns WHERE table_name = 'orders';
SELECT 'shipping policies' as check_item, count(*) as count FROM pg_policies WHERE tablename = 'orders' AND policyname LIKE 'shipping%';
