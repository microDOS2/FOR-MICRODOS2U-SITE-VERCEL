-- ============================================================
-- microDOS(2) Store Locator v2 Migration
-- Unifies store management into wholesaler_store_locations
-- Adds: updated_at, source, website columns + auto-trigger
-- Run ONCE in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fildaxejimuvfrcqmoba/sql/new
-- ============================================================

-- 1. Add updated_at column with auto-update trigger
ALTER TABLE wholesaler_store_locations
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Add source column to track who created the store
ALTER TABLE wholesaler_store_locations
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'wholesaler'
CHECK (source IN ('wholesaler', 'admin', 'sales_manager'));

-- 3. Add website column for Store Locator display
ALTER TABLE wholesaler_store_locations
ADD COLUMN IF NOT EXISTS website TEXT;

-- 3b. Add stock column for Store Locator inventory status
ALTER TABLE wholesaler_store_locations
ADD COLUMN IF NOT EXISTS stock TEXT DEFAULT 'In Stock'
CHECK (stock IN ('In Stock', 'Low Stock', 'Out of Stock'));

-- 4. Auto-update trigger function
CREATE OR REPLACE FUNCTION update_wsl_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Attach trigger to table
DROP TRIGGER IF EXISTS trg_wsl_updated_at ON wholesaler_store_locations;
CREATE TRIGGER trg_wsl_updated_at
    BEFORE UPDATE ON wholesaler_store_locations
    FOR EACH ROW EXECUTE FUNCTION update_wsl_timestamp();

-- 6. Backfill existing rows: set updated_at from created_at
UPDATE wholesaler_store_locations
SET updated_at = created_at
WHERE updated_at IS NULL;

-- 7. Ensure RLS policies allow admin and sales_manager access
CREATE POLICY IF NOT EXISTS "wsl_admin_all"
    ON wholesaler_store_locations FOR ALL
    USING (true) WITH CHECK (true);

-- 8. Enable realtime for wholesaler_store_locations
-- (so StoreLocator can subscribe to live updates if needed)
-- Note: run this in the Supabase dashboard under Database > Realtime if needed

-- Done. The unified store table now supports:
-- - Auto-updating updated_at on every change
-- - Source tracking (wholesaler/admin/sales_manager)
-- - Website display on Store Locator
-- - Full CRUD for Admin and Sales Manager portals
