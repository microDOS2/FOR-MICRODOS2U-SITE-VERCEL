-- Fix: get_managers_for_accounts now ALSO returns account's own info
-- Fix: Settings page can use get_my_manager RPC

-- 1. Update get_managers_for_accounts to include account fields
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
        -- Account fields
        'id', u.id,
        'business_name', u.business_name,
        'email', u.email,
        'phone', u.phone,
        'city', u.city,
        'state', u.state,
        'manager_id', u.manager_id,
        -- Manager fields
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

GRANT EXECUTE ON FUNCTION get_managers_for_accounts(UUID[]) TO authenticated, anon;

-- 2. get_my_accounts already created — verify it exists
-- (Created in previous fix)

-- 3. get_my_manager already created — verify it exists
-- (Created in previous fix)
