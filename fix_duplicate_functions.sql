-- ============================================================
-- FIX: Drop all duplicate functions and recreate clean versions
-- Run ALL of this in Supabase SQL Editor, then click Run
-- ============================================================

-- 1. Drop ALL versions of insert_user (remove duplicates)
DROP FUNCTION IF EXISTS insert_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS insert_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT);

-- 2. Recreate insert_user WITHOUT business_type (clean version)
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
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO users (
    id, email, business_name, role, status,
    phone, address, city, state, zip,
    license_number, ein, website, volume_estimate
  ) VALUES (
    p_id, p_email, p_business_name, p_role, p_status,
    p_phone, p_address, p_city, p_state, p_zip,
    p_license_number, p_ein, p_website, p_volume_estimate
  );
END;
$$;

GRANT EXECUTE ON FUNCTION insert_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION insert_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO anon;

-- 3. Drop and recreate update_application_status (clean)
DROP FUNCTION IF EXISTS update_application_status(UUID, TEXT, UUID);

CREATE OR REPLACE FUNCTION update_application_status(
  p_id UUID,
  p_status TEXT,
  p_auth_user_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE applications
  SET
    status = p_status,
    auth_user_id = p_auth_user_id,
    reviewed_at = NOW()
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION update_application_status(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_application_status(UUID, TEXT, UUID) TO anon;

-- 4. Drop and recreate update_user (clean)
DROP FUNCTION IF EXISTS update_user(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

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

-- 5. Drop and recreate delete_user (clean)
DROP FUNCTION IF EXISTS delete_user(UUID);

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

-- Done! All functions cleaned up.
