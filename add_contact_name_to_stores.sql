-- Migration: Add contact_name column to wholesaler_store_locations
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Add the column (nullable initially)
ALTER TABLE public.wholesaler_store_locations
ADD COLUMN IF NOT EXISTS contact_name TEXT;

-- Step 2: Backfill existing stores by parsing names from email addresses
-- Pattern: emily.williams@example.com → Emily Williams
UPDATE public.wholesaler_store_locations
SET contact_name = (
  CASE 
    WHEN email IS NOT NULL AND email <> '' THEN
      -- Extract name part before @
      -- e.g. "emily.williams.still.smoking.vapor" → "Emily Williams"
      -- Take first two dot-separated parts, title-case them
      INITCAP(
        SPLIT_PART(
          SPLIT_PART(email, '@', 1),
          '.', 1
        ) || ' ' ||
        COALESCE(
          NULLIF(SPLIT_PART(SPLIT_PART(email, '@', 1), '.', 2), ''),
          ''
        )
      )
    ELSE 'Store Contact'
  END
)
WHERE contact_name IS NULL;

-- Step 3: Make it NOT NULL (enforced at database level)
ALTER TABLE public.wholesaler_store_locations
ALTER COLUMN contact_name SET NOT NULL;

-- Step 4: Add comment
COMMENT ON COLUMN public.wholesaler_store_locations.contact_name IS 
'The individual store owner or contact person (required). Parsed from email if not provided.';

-- Verify
SELECT 
  COUNT(*) as total_stores,
  COUNT(contact_name) as with_contact,
  COUNT(*) - COUNT(contact_name) as missing_contact
FROM public.wholesaler_store_locations;
