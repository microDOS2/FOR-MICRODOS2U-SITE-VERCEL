-- ============================================================
-- Auto-confirm emails for admin-created internal users
-- This lets shipping/fulfillment (and other internal) users 
-- log in immediately without clicking an email confirmation link.
-- ============================================================

-- 1. Create SECURITY DEFINER function to confirm a user's email
--    (bypasses RLS on auth.users since it's DEFINER)
CREATE OR REPLACE FUNCTION public.confirm_user_email(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE auth.users 
    SET email_confirmed_at = NOW(), 
        confirmed_at = NOW(),
        updated_at = NOW()
    WHERE email = p_email 
      AND email_confirmed_at IS NULL;
END;
$$;

-- 2. Grant execute to authenticated users (admin calls this after creating a user)
GRANT EXECUTE ON FUNCTION public.confirm_user_email(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_user_email(TEXT) TO anon;

-- 3. Verify
SELECT 'confirm_user_email function exists' as check_item, count(*) as count
FROM pg_proc WHERE proname = 'confirm_user_email';
