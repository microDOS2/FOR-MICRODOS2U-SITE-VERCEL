-- ============================================================
-- SQL: Create RPC functions for approval flow, stores, assignments
-- Run ALL of this in Supabase SQL Editor, then click Run
-- ============================================================

-- 1. insert_store_location: auto-create store when account approved
CREATE OR REPLACE FUNCTION insert_store_location(
  p_user_id UUID,
  p_name TEXT,
  p_address TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_zip TEXT DEFAULT NULL,
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_website TEXT DEFAULT NULL,
  p_stock TEXT DEFAULT 'In Stock',
  p_license_number TEXT DEFAULT NULL,
  p_is_primary BOOLEAN DEFAULT true,
  p_is_active BOOLEAN DEFAULT true,
  p_source TEXT DEFAULT 'admin'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO wholesaler_store_locations (
    user_id, name, address, city, state, zip, lat, lng,
    phone, email, website, stock, license_number,
    is_primary, is_active, source
  ) VALUES (
    p_user_id, p_name, p_address, p_city, p_state, p_zip, p_lat, p_lng,
    p_phone, p_email, p_website, p_stock, p_license_number,
    p_is_primary, p_is_active, p_source
  );
END;
$$;

GRANT EXECUTE ON FUNCTION insert_store_location(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_store_location(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, TEXT) TO anon;

-- 2. insert_rep_assignment: assign account to sales rep
CREATE OR REPLACE FUNCTION insert_rep_assignment(
  p_rep_id UUID,
  p_account_id UUID,
  p_assigned_by UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO rep_account_assignments (rep_id, account_id, assigned_by)
  VALUES (p_rep_id, p_account_id, p_assigned_by)
  ON CONFLICT (rep_id, account_id) DO UPDATE SET
    assigned_by = p_assigned_by,
    assigned_at = NOW();
END;
$$;

GRANT EXECUTE ON FUNCTION insert_rep_assignment(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_rep_assignment(UUID, UUID, UUID) TO anon;

-- 3. get_rep_assignments: get all rep-account assignments
CREATE OR REPLACE FUNCTION get_rep_assignments()
RETURNS SETOF rep_account_assignments
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM rep_account_assignments ORDER BY assigned_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_rep_assignments() TO authenticated;
GRANT EXECUTE ON FUNCTION get_rep_assignments() TO anon;

-- Done! All functions created.
