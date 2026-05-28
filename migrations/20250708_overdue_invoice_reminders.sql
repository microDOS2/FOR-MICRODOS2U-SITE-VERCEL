-- Add reminder tracking columns to invoices table
-- Run in Supabase SQL Editor

-- Only add columns if they don't exist
DO $$ BEGIN
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
  ALTER TABLE invoices ADD COLUMN IF NOT EXISTS reminder_count int DEFAULT 0;
EXCEPTION
  WHEN duplicate_column THEN
    -- Columns already exist, nothing to do
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_invoices_reminder_sent_at ON invoices(reminder_sent_at) WHERE status = 'pending';

-- Done. Invoices can now track overdue reminders.
