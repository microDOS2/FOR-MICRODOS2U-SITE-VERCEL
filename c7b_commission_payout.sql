-- ============================================================
-- C7b: Commission Payout Workflow Migration
-- Adds payment tracking columns to commission_payments
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fildaxejimuvfrcqmoba/sql/new
-- ============================================================

-- Add payment tracking columns (if not already present)
ALTER TABLE commission_payments
    ADD COLUMN IF NOT EXISTS paid_method TEXT,
    ADD COLUMN IF NOT EXISTS paid_reference TEXT;

COMMENT ON COLUMN commission_payments.paid_method IS 'How the commission was paid: Check, ACH, PayPal, Venmo, Zelle, Cash App, Other';
COMMENT ON COLUMN commission_payments.paid_reference IS 'Payment reference: check number, confirmation code, etc.';

-- Update the RPC to include payment method when paying
CREATE OR REPLACE FUNCTION pay_commissions_for_period(
    p_period_year INTEGER,
    p_period_month INTEGER,
    p_paid_method TEXT DEFAULT NULL,
    p_paid_reference TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    -- First approve any pending commissions for this period
    UPDATE commission_payments
    SET status = 'approved', approved_at = NOW()
    WHERE period_year = p_period_year
      AND period_month = p_period_month
      AND status = 'pending';

    -- Then mark as paid with payment details
    UPDATE commission_payments
    SET 
        status = 'paid',
        paid_at = NOW(),
        paid_method = p_paid_method,
        paid_reference = p_paid_reference
    WHERE period_year = p_period_year
      AND period_month = p_period_month
      AND status = 'approved';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- RPC to approve commissions for a period (step 1 of 2)
CREATE OR REPLACE FUNCTION approve_commissions_for_period(
    p_period_year INTEGER,
    p_period_month INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE commission_payments
    SET status = 'approved', approved_at = NOW()
    WHERE period_year = p_period_year
      AND period_month = p_period_month
      AND status = 'pending';

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$;

-- RPC to pay a single commission entry (for individual payments)
CREATE OR REPLACE FUNCTION pay_single_commission(
    p_commission_id UUID,
    p_paid_method TEXT DEFAULT NULL,
    p_paid_reference TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE commission_payments
    SET 
        status = 'paid',
        paid_at = NOW(),
        paid_method = p_paid_method,
        paid_reference = p_paid_reference
    WHERE id = p_commission_id
      AND status IN ('pending', 'approved');

    RETURN FOUND;
END;
$$;

-- ============================================================
-- DONE! C7b payout workflow columns and functions ready.
-- ============================================================
