-- Commission Tracking Tables
-- Run this in Supabase Dashboard → SQL Editor

-- Commission settings (single row, admin-controlled)
CREATE TABLE IF NOT EXISTS commission_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_rate decimal(5,2) NOT NULL DEFAULT 5.00,
  manager_override_rate decimal(5,2) NOT NULL DEFAULT 2.00,
  updated_at timestamptz DEFAULT now()
);

-- Seed default settings
INSERT INTO commission_settings (rep_rate, manager_override_rate)
SELECT 5.00, 2.00
WHERE NOT EXISTS (SELECT 1 FROM commission_settings);

-- Commission entries (auto-generated per paid+shipped order)
CREATE TABLE IF NOT EXISTS commission_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  account_id uuid REFERENCES users(id),
  rep_id uuid REFERENCES users(id),
  manager_id uuid REFERENCES users(id),
  order_amount decimal(10,2) NOT NULL,
  rep_rate decimal(5,2) NOT NULL,
  rep_earnings decimal(10,2) NOT NULL,
  manager_rate decimal(5,2),
  manager_earnings decimal(10,2),
  period text NOT NULL, -- e.g., '2026-06'
  status text NOT NULL DEFAULT 'accrued' CHECK (status IN ('accrued', 'processing', 'paid')),
  paid_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Commission adjustments (chargebacks, manual corrections)
CREATE TABLE IF NOT EXISTS commission_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  commission_entry_id uuid REFERENCES commission_entries(id) ON DELETE CASCADE,
  amount decimal(10,2) NOT NULL,
  reason text NOT NULL,
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_commission_entries_rep ON commission_entries(rep_id);
CREATE INDEX IF NOT EXISTS idx_commission_entries_manager ON commission_entries(manager_id);
CREATE INDEX IF NOT EXISTS idx_commission_entries_period ON commission_entries(period);
CREATE INDEX IF NOT EXISTS idx_commission_entries_status ON commission_entries(status);

-- Enable RLS
ALTER TABLE commission_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_adjustments ENABLE ROW LEVEL SECURITY;

-- Admin can see all
CREATE POLICY admin_all_settings ON commission_settings FOR ALL TO authenticated USING (true);
CREATE POLICY admin_all_entries ON commission_entries FOR ALL TO authenticated USING (true);
CREATE POLICY admin_all_adjustments ON commission_adjustments FOR ALL TO authenticated USING (true);

-- Reps can see their own
CREATE POLICY rep_own_entries ON commission_entries
  FOR SELECT TO authenticated
  USING (rep_id = auth.uid());

-- Managers can see their overrides
CREATE POLICY mgr_own_entries ON commission_entries
  FOR SELECT TO authenticated
  USING (manager_id = auth.uid());
