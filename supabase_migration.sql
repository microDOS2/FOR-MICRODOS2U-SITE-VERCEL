-- ============================================================
-- microDOS(2) Product Schema Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/fildaxejimuvfrcqmoba/sql/new
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

-- 2. Enable RLS
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "product_variants_public_read" 
    ON product_variants FOR SELECT USING (true);

CREATE POLICY "product_variants_admin_all" 
    ON product_variants FOR ALL USING (true) WITH CHECK (true);

-- 4. Update existing 3 products to correct catalog
UPDATE products SET 
    name = 'Box', 
    sku = 'MD2-BX',
    description = '10 pills per box',
    stock = 5000,
    min_order = 1,
    is_active = true
WHERE id = '1010391b-6d21-4adc-b951-3511dd33c290';

UPDATE products SET 
    name = 'Starter Card', 
    sku = 'MD2-SC',
    description = '2 pills in blister package',
    stock = 3000,
    min_order = 1,
    is_active = true
WHERE id = 'f9f54ceb-5015-4e24-b5f8-308d7e7cb5a4';

UPDATE products SET 
    name = 'Wholesaler Starter Kit', 
    sku = 'MD2-KIT',
    description = 'Everything to get started selling microDOS(2): 9 boxes, 7 starter cards, display stand, placard',
    stock = 500,
    min_order = 1,
    is_active = true
WHERE id = '38fcdbe8-77be-4793-a6b7-9a4c2838b576';

-- 5. Insert packaging variants for Box
INSERT INTO product_variants (product_id, tier, name, quantity, total_pills, sku, msrp_price, wholesaler_price, distributor_price, in_stock)
VALUES 
    ('1010391b-6d21-4adc-b951-3511dd33c290', 'individual', 'Individual', 1, 10, 'MD2-BX-001', 45.00, 22.50, 16.86, true),
    ('1010391b-6d21-4adc-b951-3511dd33c290', 'case', 'Case (12 boxes)', 12, 120, 'MD2-BX-012', 540.00, 270.00, 202.32, true),
    ('1010391b-6d21-4adc-b951-3511dd33c290', 'master_case', 'Master Case (36 boxes)', 36, 360, 'MD2-BX-036', 1620.00, 810.00, 606.96, true);

-- 6. Insert packaging variants for Starter Card
INSERT INTO product_variants (product_id, tier, name, quantity, total_pills, sku, msrp_price, wholesaler_price, distributor_price, in_stock)
VALUES 
    ('f9f54ceb-5015-4e24-b5f8-308d7e7cb5a4', 'individual', 'Individual', 1, 2, 'MD2-SC-001', 9.95, 4.98, 3.73, true),
    ('f9f54ceb-5015-4e24-b5f8-308d7e7cb5a4', 'case', 'Case (21 cards)', 21, 42, 'MD2-SC-021', 208.95, 104.58, 78.33, true),
    ('f9f54ceb-5015-4e24-b5f8-308d7e7cb5a4', 'master_case', 'Master Case (63 cards)', 63, 126, 'MD2-SC-063', 626.85, 313.74, 234.99, true);

-- 7. Insert single variant for Wholesaler Starter Kit
INSERT INTO product_variants (product_id, tier, name, quantity, total_pills, sku, msrp_price, wholesaler_price, distributor_price, in_stock)
VALUES 
    ('38fcdbe8-77be-4793-a6b7-9a4c2838b576', 'special', 'Wholesaler Starter Kit', 1, 104, 'MD2-KIT-WHOLESALE', 474.65, 155.76, 116.82, true);

-- 8. Clean up site_settings temp data if it exists
DELETE FROM site_settings WHERE key = 'product_variants';

-- Done! Now the Products catalog and Admin Products page read from the same live data.
