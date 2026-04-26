-- ============================================================
-- Fix: Allow sales reps to see manager info for their accounts
-- SECURITY DEFINER RPC bypasses RLS
-- Run ALL of this in Supabase SQL Editor
-- ============================================================

DROP FUNCTION IF EXISTS get_managers_for_accounts(UUID[]);
CREATE OR REPLACE FUNCTION get_managers_for_accounts(p_account_ids UUID[])
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', u.id,
        'manager_id', u.manager_id,
        'manager_name', mgr.business_name,
        'manager_email', mgr.email,
        'manager_phone', mgr.phone,
        'manager_city', mgr.city,
        'manager_state', mgr.state
      )
    ),
    '[]'::jsonb
  )
  FROM users u
  LEFT JOIN users mgr ON mgr.id = u.manager_id
  WHERE u.id = ANY(p_account_ids);
$$;

GRANT EXECUTE ON FUNCTION get_managers_for_accounts(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION get_managers_for_accounts(UUID[]) TO anon;
