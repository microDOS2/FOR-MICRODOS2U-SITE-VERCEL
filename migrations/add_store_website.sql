-- Add website column to wholesaler_store_locations (safe to re-run)
ALTER TABLE IF EXISTS public.wholesaler_store_locations
ADD COLUMN IF NOT EXISTS website text;

-- Add comment for documentation
COMMENT ON COLUMN public.wholesaler_store_locations.website IS 'Store website URL (optional)';
