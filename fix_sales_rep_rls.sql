-- ============================================================
-- Fix: Sales Rep RLS — cannot read own assignments or manager info
-- Run ALL of this in Supabase SQL Editor
-- ============================================================

-- 1. get_my_accounts: returns all accounts for a rep with manager info
DROP FUNCTION IF EXISTS get_my_accounts(UUID);
CREATE OR REPLACE FUNCTION get_my_accounts(p_rep_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', a.id,
        'business_name', a.business_name,
        'email', a.email,
        'phone', a.phone,
        'role', a.role,
        'city', a.city,
        'state', a.state,
        'address', a.address,
        'referral_code', a.referral_code,
        'manager_id', a.manager_id,
        'manager_name', mgr.business_name,
        'manager_email', mgr.email,
        'manager_phone', mgr.phone,
        'manager_city', mgr.city,
        'manager_state', mgr.state
      ) ORDER BY a.business_name ASC
    ),
    '[]'::jsonb
  )
  FROM rep_account_assignments ra
  JOIN users a ON a.id = ra.account_id
  LEFT JOIN users mgr ON mgr.id = a.manager_id
  WHERE ra.rep_id = p_rep_id;
$$;

-- 2. get_my_manager: returns the manager info for a rep
DROP FUNCTION IF EXISTS get_my_manager(UUID);
CREATE OR REPLACE FUNCTION get_my_manager(p_rep_id UUID)
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_build_object(
      'manager_id', mgr.id,
      'manager_name', mgr.business_name,
      'manager_email', mgr.email,
      'manager_phone', mgr.phone,
      'manager_city', mgr.city,
      'manager_state', mgr.state
    ),
    '{}'::jsonb
  )
  FROM users rep
  LEFT JOIN users mgr ON mgr.id = rep.manager_id
  WHERE rep.id = p_rep_id;
$$;

GRANT EXECUTE ON FUNCTION get_my_accounts(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_accounts(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_my_manager(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_manager(UUID) TO anon;
