-- Fix: Allow admin to edit any user (bypasses RLS)
-- Run this in your Supabase SQL Editor

CREATE OR REPLACE FUNCTION update_user(
  p_id UUID,
  p_business_name TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_state TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE users
  SET
    business_name = COALESCE(p_business_name, business_name),
    phone = p_phone,
    city = p_city,
    state = p_state,
    status = COALESCE(p_status, status),
    updated_at = NOW()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION update_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

-- Also create a delete function
CREATE OR REPLACE FUNCTION delete_user(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM users WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user(UUID) TO anon;

-- Done!
