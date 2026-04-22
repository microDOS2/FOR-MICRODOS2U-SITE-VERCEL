-- ============================================================
-- Fix: Allow admin Users page to see ALL users (bypass RLS)
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Create a function that returns all users (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION get_all_users()
RETURNS SETOF users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM users ORDER BY created_at DESC;
$$;

-- 2. Grant execute to authenticated users (admin will call this)
GRANT EXECUTE ON FUNCTION get_all_users() TO authenticated;
GRANT EXECUTE ON FUNCTION get_all_users() TO anon;

-- Done! The admin Users page can now fetch all users via RPC call
