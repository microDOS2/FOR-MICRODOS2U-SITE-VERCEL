-- Add monthly_target column to users table
ALTER TABLE IF EXISTS public.users
ADD COLUMN IF NOT EXISTS monthly_target numeric DEFAULT 10000;

-- Set existing sales reps to default target
UPDATE public.users SET monthly_target = 10000 WHERE role = 'sales_rep' AND monthly_target IS NULL;

-- Grant read/update on this column via RLS (users already have broad read)
-- Managers can update their reps' targets
DROP POLICY IF EXISTS "users_update_manager_target" ON public.users;
CREATE POLICY "users_update_manager_target" ON public.users
  FOR UPDATE TO authenticated USING (
    role = 'sales_rep' AND manager_id = auth.uid()
  ) WITH CHECK (
    role = 'sales_rep' AND manager_id = auth.uid()
  );
