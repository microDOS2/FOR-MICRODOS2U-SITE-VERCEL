-- Migration: Populate rep_account_assignments from store license_number data
-- Run this in Supabase Dashboard → SQL Editor

-- Step 1: Create a temporary function to extract rep_id from license_number
-- Step 2: For each store with rep: in license_number, find the account and create assignment

DO $$
DECLARE
    store_rec RECORD;
    rep_uuid UUID;
    acct_num TEXT;
    acct_id UUID;
    store_name TEXT;
BEGIN
    -- Loop through all stores that have a rep assignment in license_number
    FOR store_rec IN 
        SELECT id, name, license_number 
        FROM wholesaler_store_locations 
        WHERE license_number LIKE 'rep:%'
    LOOP
        -- Extract rep UUID from license_number (e.g., "rep:john-doe-uuid")
        BEGIN
            rep_uuid := (regexp_match(store_rec.license_number, 'rep:([0-9a-f-]+)'))[1]::UUID;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Cannot parse rep UUID from license_number: %', store_rec.license_number;
            CONTINUE;
        END;

        -- Extract account number from store name (e.g., "100a - Store Name" → "100")
        store_name := store_rec.name;
        acct_num := (regexp_match(store_name, '^([0-9]+)[a-z]'))[1];

        IF acct_num IS NULL THEN
            RAISE NOTICE 'Cannot parse account number from store name: %', store_name;
            CONTINUE;
        END IF;

        -- Find the account by referral_code
        SELECT id INTO acct_id 
        FROM users 
        WHERE referral_code = acct_num 
          AND role IN ('wholesaler', 'distributor')
          AND status = 'approved';

        IF acct_id IS NULL THEN
            RAISE NOTICE 'No account found for referral_code: %', acct_num;
            CONTINUE;
        END IF;

        -- Insert rep_account_assignments if not exists
        INSERT INTO rep_account_assignments (rep_id, account_id, assigned_at)
        VALUES (rep_uuid, acct_id, NOW())
        ON CONFLICT (rep_id, account_id) DO NOTHING;

        RAISE NOTICE 'Created assignment: rep % → account % (% from store %)', 
            rep_uuid, acct_id, acct_num, store_rec.name;
    END LOOP;
END $$;

-- Verify results
SELECT 
    raa.rep_id,
    u1.business_name as rep_name,
    u1.email as rep_email,
    u2.business_name as account_name,
    u2.referral_code as account_number,
    COUNT(DISTINCT wsl.id) as store_count
FROM rep_account_assignments raa
JOIN users u1 ON u1.id = raa.rep_id
JOIN users u2 ON u2.id = raa.account_id
LEFT JOIN wholesaler_store_locations wsl ON wsl.name ~ ('^' || u2.referral_code || '[a-z]')
GROUP BY raa.rep_id, u1.business_name, u1.email, u2.business_name, u2.referral_code
ORDER BY rep_name;
