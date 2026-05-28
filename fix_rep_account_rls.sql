-- Fix: Allow accounts to read their rep assignments and rep details
-- Run this in Supabase SQL Editor

-- 1. Allow any authenticated user to read rep_account_assignments
-- This is needed for AccountRepCard to show "Your Sales Rep"
DROP POLICY IF EXISTS "auth_read_rep_assignments" ON rep_account_assignments;
CREATE POLICY "auth_read_rep_assignments"
    ON rep_account_assignments FOR SELECT
    USING (auth.role() = 'authenticated');

-- Done. The AccountRepCard component will now be able to query
-- rep_account_assignments and users tables to show the assigned rep.
