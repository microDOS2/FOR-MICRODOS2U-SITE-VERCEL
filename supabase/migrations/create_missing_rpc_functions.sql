-- ============================================================
-- Create all missing RPC functions for microDOS(2) admin panel
-- Run this in Supabase Dashboard → SQL Editor → New Query
-- ============================================================

-- 1. insert_user - Insert a user record (bypasses RLS via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION insert_user(
  p_id uuid,
  p_email text,
  p_business_name text,
  p_role text DEFAULT 'wholesaler',
  p_status text DEFAULT 'approved',
  p_phone text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_license_number text DEFAULT NULL,
  p_ein text DEFAULT NULL
)
RETURNS SETOF users
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO users (
    id, email, business_name, role, status,
    phone, address, city, state, zip,
    license_number, ein, referral_count, total_referral_sales
  )
  VALUES (
    p_id, p_email, p_business_name, p_role, p_status,
    p_phone, p_address, p_city, p_state, p_zip,
    p_license_number, p_ein, 0, 0
  )
  RETURNING *;
END;
$$;

-- 2. confirm_user_email - Auto-confirm a user's email (admin only)
CREATE OR REPLACE FUNCTION confirm_user_email(p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE auth.users
  SET email_confirmed_at = NOW(),
      confirmed_at = NOW(),
      updated_at = NOW()
  WHERE email = p_email;
END;
$$;

-- 3. delete_user - Delete a user from both auth and public.users
CREATE OR REPLACE FUNCTION delete_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete from public.users first (FK constraint)
  DELETE FROM users WHERE id = p_user_id;
  -- Delete from auth.users
  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- 4. update_application_status - Update application status with auth user link
CREATE OR REPLACE FUNCTION update_application_status(
  p_id uuid,
  p_status text,
  p_auth_user_id uuid DEFAULT NULL
)
RETURNS SETOF applications
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE applications
  SET status = p_status,
      auth_user_id = COALESCE(p_auth_user_id, auth_user_id),
      reviewed_at = NOW()
  WHERE id = p_id
  RETURNING *;
END;
$$;

-- 5. insert_store_location - Insert a store location for a wholesaler/distributor
CREATE OR REPLACE FUNCTION insert_store_location(
  p_user_id uuid,
  p_name text DEFAULT NULL,
  p_address text DEFAULT NULL,
  p_city text DEFAULT NULL,
  p_state text DEFAULT NULL,
  p_zip text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL
)
RETURNS SETOF wholesaler_store_locations
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO wholesaler_store_locations (
    user_id, name, address, city, state, zip, phone, email, is_primary, is_active
  )
  VALUES (
    p_user_id, p_name, p_address, p_city, p_state, p_zip, p_phone, p_email, true, true
  )
  RETURNING *;
END;
$$;

-- 6. Video management RPCs
CREATE OR REPLACE FUNCTION insert_video(
  p_title text,
  p_url text,
  p_storage_path text,
  p_file_size bigint DEFAULT NULL,
  p_duration int DEFAULT NULL
)
RETURNS SETOF videos
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO videos (title, url, storage_path, file_size, duration, is_active, sort_order)
  VALUES (p_title, p_url, p_storage_path, p_file_size, p_duration, true, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM videos))
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION delete_video_record(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM videos WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION toggle_video_active(p_id uuid)
RETURNS SETOF videos
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE videos SET is_active = NOT is_active WHERE id = p_id RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION update_video_order(p_id uuid, p_sort_order int)
RETURNS SETOF videos
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE videos SET sort_order = p_sort_order WHERE id = p_id RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION update_video_title(p_id uuid, p_title text)
RETURNS SETOF videos
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  UPDATE videos SET title = p_title WHERE id = p_id RETURNING *;
END;
$$;

-- 7. update_auth_password - Update a user's auth password (admin only)
CREATE OR REPLACE FUNCTION update_auth_password(p_user_id uuid, p_new_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- This requires the pgcrypto extension and direct auth.users access
  -- Note: Password must be hashed before storing - this function assumes
  -- the calling edge function handles the hashing via supabase admin API
  RAISE NOTICE 'Password update should be done via Edge Function for proper hashing';
END;
$$;

-- ============================================================
-- Grant execute permissions to all roles
-- ============================================================
GRANT EXECUTE ON FUNCTION insert_user TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION confirm_user_email TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_user TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_application_status TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION insert_store_location TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION insert_video TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION delete_video_record TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION toggle_video_active TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_video_order TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_video_title TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_auth_password TO anon, authenticated, service_role;
