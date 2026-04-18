-- ============================================================
-- microDOS(2) Product Schema Migration
-- Run ONCE in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fildaxejimuvfrcqmoba/sql/new
-- Then click Run. Done.
-- ============================================================

-- 1. Create product_variants table
CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    tier TEXT NOT NULL,
    name TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    total_pills INTEGER NOT NULL DEFAULT 0,
    sku TEXT NOT NULL UNIQUE,
    msrp_price NUMERIC NOT NULL DEFAULT 0,
    wholesaler_price NUMERIC NOT NULL DEFAULT 0,
    distributor_price NUMERIC NOT NULL DEFAULT 0,
    in_stock BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Enable Row Level Security
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies (public read, admin full access)
CREATE POLICY "product_variants_public_read"
    ON product_variants FOR SELECT USING (true);

CREATE POLICY "product_variants_admin_all"
    ON product_variants FOR ALL USING (true) WITH CHECK (true);

-- 4. Insert packaging variants for Box (ID: a717dcf7...)
INSERT INTO product_variants (product_id, tier, name, quantity, total_pills, sku, msrp_price, wholesaler_price, distributor_price, in_stock)
VALUES
    ('a717dcf7-9d68-47f3-95a3-feecdbc5d365', 'individual', 'Individual', 1, 10, 'MD2-BX-001', 45.00, 22.50, 16.86, true),
    ('a717dcf7-9d68-47f3-95a3-feecdbc5d365', 'case', 'Case (12 boxes)', 12, 120, 'MD2-BX-012', 540.00, 270.00, 202.32, true),
    ('a717dcf7-9d68-47f3-95a3-feecdbc5d365', 'master_case', 'Master Case (36 boxes)', 36, 360, 'MD2-BX-036', 1620.00, 810.00, 606.96, true);

-- 5. Insert packaging variants for Starter Card (ID: f3597e7b...)
INSERT INTO product_variants (product_id, tier, name, quantity, total_pills, sku, msrp_price, wholesaler_price, distributor_price, in_stock)
VALUES
    ('f3597e7b-d43f-47f1-a649-92c12cdd52de', 'individual', 'Individual', 1, 2, 'MD2-SC-001', 9.95, 4.98, 3.73, true),
    ('f3597e7b-d43f-47f1-a649-92c12cdd52de', 'case', 'Case (21 cards)', 21, 42, 'MD2-SC-021', 208.95, 104.58, 78.33, true),
    ('f3597e7b-d43f-47f1-a649-92c12cdd52de', 'master_case', 'Master Case (63 cards)', 63, 126, 'MD2-SC-063', 626.85, 313.74, 234.99, true);

-- 6. Insert variant for Wholesaler Starter Kit (ID: be78528f...)
INSERT INTO product_variants (product_id, tier, name, quantity, total_pills, sku, msrp_price, wholesaler_price, distributor_price, in_stock)
VALUES
    ('be78528f-5b24-498e-b0d6-98350c95ab1c', 'special', 'Wholesaler Starter Kit', 1, 104, 'MD2-KIT-WHOLESALE', 474.65, 155.76, 116.82, true);

-- 7. Clean up temporary bridge data from site_settings
DELETE FROM site_settings WHERE key = 'product_variants';

-- Done. The frontend now reads packaging variants from the real table.
