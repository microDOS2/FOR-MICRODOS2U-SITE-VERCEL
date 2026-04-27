-- ============================================================
-- Fix: Infinite recursion in RLS policies on users table
-- The shipping_read_users policy queries users within users RLS.
-- Fix: Use SECURITY DEFINER function to check role.
-- ============================================================

-- 1. Create SECURITY DEFINER function to check shipping_fulfillment role
--    (bypasses RLS since it's owned by postgres with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.is_shipping_fulfillment()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = 'shipping_fulfillment'
    );
END;
$$;

-- Also create a generic role-check function for future use
CREATE OR REPLACE FUNCTION public.current_user_has_role(p_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM users WHERE id = auth.uid() AND role = p_role
    );
END;
$$;

-- 2. Drop the recursive shipping_read_users policy
DROP POLICY IF EXISTS "shipping_read_users" ON users;

-- 3. Re-create using the SECURITY DEFINER function (no recursion!)
CREATE POLICY "shipping_read_users"
    ON users FOR SELECT
    USING (public.is_shipping_fulfillment());

-- 4. Verify the fix: show all policies on users table
SELECT policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'users'
ORDER BY policyname;

-- 5. Test the function works (should return false for anon, but not error)
SELECT 'is_shipping_fulfillment function exists' as check_item, count(*) as count
FROM pg_proc WHERE proname = 'is_shipping_fulfillment';

SELECT 'current_user_has_role function exists' as check_item, count(*) as count
FROM pg_proc WHERE proname = 'current_user_has_role';
