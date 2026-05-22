-- Migration: Add also_rep column to users table for Manager-as-Rep dual role
-- Run this in Supabase Dashboard → SQL Editor

-- Add the column with default false
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS also_rep BOOLEAN NOT NULL DEFAULT FALSE;

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_users_also_rep
ON public.users(also_rep)
WHERE also_rep = TRUE;

-- Add comment explaining the column
COMMENT ON COLUMN public.users.also_rep IS 'When TRUE and role=sales_manager, the user can also act as a sales rep with a unified dashboard';

-- Verify
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'also_rep';
