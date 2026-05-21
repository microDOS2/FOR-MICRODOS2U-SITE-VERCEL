-- ============================================================
-- Migration: Create missing tables, drop plain_password,
--            and create missing RPC functions
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fildaxejimuvfrcqmoba/sql
-- ============================================================

-- 1. Drop the plain_password column from users table (SECURITY FIX)
ALTER TABLE users DROP COLUMN IF EXISTS plain_password;

-- 2. Drop the influencers table if it exists (no longer needed)
DROP TABLE IF EXISTS influencers CASCADE;

-- 3. Create the territories table
CREATE TABLE IF NOT EXISTS territories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    states TEXT[] DEFAULT '{}',
    manager_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Enable RLS on new tables
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for admin access
CREATE POLICY "Admin full access to territories"
    ON territories FOR ALL
    USING (auth.uid() IN (SELECT id FROM users WHERE role = 'admin'));

-- 6. Drop existing functions first (in case they exist with different signatures)
DROP FUNCTION IF EXISTS insert_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS update_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS assign_manager(UUID, UUID);
DROP FUNCTION IF EXISTS assign_state(UUID, TEXT);
DROP FUNCTION IF EXISTS remove_state(UUID, TEXT);
DROP FUNCTION IF EXISTS delete_user(UUID);
DROP FUNCTION IF EXISTS transfer_accounts_batch_json(UUID, UUID, JSONB);
DROP FUNCTION IF EXISTS get_pending_transfers(UUID);
DROP FUNCTION IF EXISTS accept_transfer(UUID);
DROP FUNCTION IF EXISTS reject_transfer(UUID);
DROP FUNCTION IF EXISTS admin_resolve_transfer(UUID, TEXT);
DROP FUNCTION IF EXISTS get_my_accounts(UUID);
DROP FUNCTION IF EXISTS get_my_manager(UUID);
DROP FUNCTION IF EXISTS get_managers_for_accounts(UUID[]);
DROP FUNCTION IF EXISTS get_reps_for_manager(UUID);

-- 7. Create the missing RPC functions that were referenced in code

-- Function: insert_user (was used in ApplicationsPage)
CREATE OR REPLACE FUNCTION insert_user(
    p_id UUID,
    p_email TEXT,
    p_business_name TEXT,
    p_role TEXT,
    p_status TEXT DEFAULT 'approved',
    p_phone TEXT DEFAULT NULL,
    p_address TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_zip TEXT DEFAULT NULL,
    p_license_number TEXT DEFAULT NULL,
    p_ein TEXT DEFAULT NULL,
    p_website TEXT DEFAULT NULL,
    p_volume_estimate TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    INSERT INTO users (id, email, business_name, role, status, phone, address, city, state, zip, license_number, ein, website, volume_estimate, referral_count, total_referral_sales)
    VALUES (p_id, p_email, p_business_name, p_role, p_status, p_phone, p_address, p_city, p_state, p_zip, p_license_number, p_ein, p_website, p_volume_estimate, 0, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: update_user (was used in UsersPage)
CREATE OR REPLACE FUNCTION update_user(
    p_id UUID,
    p_business_name TEXT DEFAULT NULL,
    p_phone TEXT DEFAULT NULL,
    p_city TEXT DEFAULT NULL,
    p_state TEXT DEFAULT NULL,
    p_status TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE users SET
        business_name = COALESCE(p_business_name, business_name),
        phone = COALESCE(p_phone, phone),
        city = COALESCE(p_city, city),
        state = COALESCE(p_state, state),
        status = COALESCE(p_status, status)
    WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: assign_manager (was used in UsersPage, AssignmentsPage)
CREATE OR REPLACE FUNCTION assign_manager(
    target_user_id UUID,
    new_manager_id UUID
) RETURNS VOID AS $$
BEGIN
    UPDATE users SET manager_id = new_manager_id WHERE id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: assign_state (was used in UsersPage for territory management)
CREATE OR REPLACE FUNCTION assign_state(
    p_manager_id UUID,
    p_state_code TEXT
) RETURNS VOID AS $$
BEGIN
    INSERT INTO manager_state_assignments (manager_id, state_code)
    VALUES (p_manager_id, p_state_code)
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: remove_state (was used in UsersPage for territory management)
CREATE OR REPLACE FUNCTION remove_state(
    p_manager_id UUID,
    p_state_code TEXT
) RETURNS VOID AS $$
BEGIN
    DELETE FROM manager_state_assignments WHERE manager_id = p_manager_id AND state_code = p_state_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: delete_user (was used in UsersPage)
CREATE OR REPLACE FUNCTION delete_user(p_id UUID)
RETURNS VOID AS $$
BEGIN
    DELETE FROM users WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: transfer_accounts_batch_json (was used in TerritoryTransferPage)
CREATE OR REPLACE FUNCTION transfer_accounts_batch_json(
    p_source_manager_id UUID,
    p_target_manager_id UUID,
    p_transfers JSONB
) RETURNS JSONB AS $$
DECLARE
    transfer JSONB;
    moved_accounts INT := 0;
    moved_reps INT := 0;
BEGIN
    FOR transfer IN SELECT * FROM jsonb_array_elements(p_transfers)
    LOOP
        UPDATE users SET manager_id = p_target_manager_id WHERE id = (transfer->>'account_id')::UUID;
        moved_accounts := moved_accounts + 1;
        
        IF (transfer->>'rep_id') IS NOT NULL THEN
            UPDATE users SET manager_id = p_target_manager_id WHERE id = (transfer->>'rep_id')::UUID;
            moved_reps := moved_reps + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object('moved_accounts', moved_accounts, 'moved_reps', moved_reps, 'transfer_count', moved_accounts);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_pending_transfers (was used in SalesManagerDashboard)
CREATE OR REPLACE FUNCTION get_pending_transfers(p_manager_id UUID)
RETURNS TABLE (
    id UUID,
    type TEXT,
    rep_id UUID,
    account_id UUID,
    old_manager_id UUID,
    new_manager_id UUID,
    status TEXT,
    created_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM assignment_transfers
    WHERE new_manager_id = p_manager_id AND status = 'pending'
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: accept_transfer (was used in SalesManagerDashboard)
CREATE OR REPLACE FUNCTION accept_transfer(p_transfer_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE assignment_transfers 
    SET status = 'accepted', resolved_at = NOW() 
    WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: reject_transfer (was used in SalesManagerDashboard)
CREATE OR REPLACE FUNCTION reject_transfer(p_transfer_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE assignment_transfers 
    SET status = 'rejected', resolved_at = NOW() 
    WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: admin_resolve_transfer (was used in TransferHistoryPage)
CREATE OR REPLACE FUNCTION admin_resolve_transfer(
    p_transfer_id UUID,
    p_status TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE assignment_transfers 
    SET status = p_status, resolved_at = NOW() 
    WHERE id = p_transfer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_my_accounts (was used in SalesRepAccounts)
CREATE OR REPLACE FUNCTION get_my_accounts(p_rep_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    business_name TEXT,
    phone TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    license_number TEXT,
    ein TEXT,
    website TEXT,
    address TEXT,
    volume_estimate TEXT,
    status TEXT,
    role TEXT,
    manager_id UUID,
    referral_code TEXT,
    referral_count INTEGER,
    total_referral_sales NUMERIC,
    qr_url TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.* FROM users u
    INNER JOIN rep_account_assignments raa ON u.id = raa.account_id
    WHERE raa.rep_id = p_rep_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_my_manager (was used in SalesRepSettings)
CREATE OR REPLACE FUNCTION get_my_manager(p_rep_id UUID)
RETURNS TABLE (
    manager_id UUID,
    manager_name TEXT,
    manager_email TEXT,
    manager_phone TEXT,
    manager_city TEXT,
    manager_state TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        m.id AS manager_id,
        m.business_name AS manager_name,
        m.email AS manager_email,
        m.phone AS manager_phone,
        m.city AS manager_city,
        m.state AS manager_state
    FROM users u
    JOIN users m ON u.manager_id = m.id
    WHERE u.id = p_rep_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_managers_for_accounts (was used in SalesRepStores)
CREATE OR REPLACE FUNCTION get_managers_for_accounts(p_account_ids UUID[])
RETURNS TABLE (
    id UUID,
    business_name TEXT,
    email TEXT,
    phone TEXT,
    manager_id UUID,
    manager_name TEXT,
    manager_email TEXT,
    manager_phone TEXT,
    manager_city TEXT,
    manager_state TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        u.business_name,
        u.email,
        u.phone,
        u.manager_id,
        m.business_name AS manager_name,
        m.email AS manager_email,
        m.phone AS manager_phone,
        m.city AS manager_city,
        m.state AS manager_state
    FROM users u
    LEFT JOIN users m ON u.manager_id = m.id
    WHERE u.id = ANY(p_account_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get_reps_for_manager (used in SalesManagerAccounts)
CREATE OR REPLACE FUNCTION get_reps_for_manager(p_manager_id UUID)
RETURNS TABLE (
    id UUID,
    email TEXT,
    business_name TEXT,
    phone TEXT,
    city TEXT,
    state TEXT,
    status TEXT,
    role TEXT,
    created_at TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT u.id, u.email, u.business_name, u.phone, u.city, u.state, u.status, u.role, u.created_at
    FROM users u
    WHERE u.manager_id = p_manager_id AND u.role = 'sales_rep'
    ORDER BY u.business_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
