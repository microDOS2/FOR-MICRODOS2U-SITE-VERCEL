-- ============================================================
-- microDOS(2) Commission System Migration v2
-- Adds account_type dimension (wholesaler/distributor) to rates
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fildaxejimuvfrcqmoba/sql/new
-- ============================================================

-- Drop old tables if they exist from previous partial migration
DROP TABLE IF EXISTS commission_payments CASCADE;
DROP TABLE IF EXISTS user_commission_overrides CASCADE;
DROP TABLE IF EXISTS commission_rules CASCADE;
DROP FUNCTION IF EXISTS get_commission_rate_for_user(UUID, TEXT);
DROP FUNCTION IF EXISTS generate_commissions_for_order(UUID);
DROP FUNCTION IF EXISTS generate_order_commissions(UUID);
DROP FUNCTION IF EXISTS get_all_commissions();
DROP FUNCTION IF EXISTS get_user_commissions(UUID);
DROP FUNCTION IF EXISTS get_commission_performance(TEXT);

-- ============================================================
-- 1. COMMISSION RULES TABLE (Default rates per role + account_type)
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL, -- 'sales_rep' or 'sales_manager'
    account_type TEXT NOT NULL DEFAULT 'all', -- 'wholesaler', 'distributor', or 'all'
    rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'standard',
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role, account_type)
);

COMMENT ON TABLE commission_rules IS 'Default commission rates per role and account type. Admin-configurable.';

-- ============================================================
-- 2. USER COMMISSION OVERRIDES TABLE (Per-user rate overrides)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_commission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL DEFAULT 'sales_rep',
    account_type TEXT NOT NULL DEFAULT 'all', -- 'wholesaler', 'distributor', or 'all'
    override_rate_percent NUMERIC(5,2), -- NULL = use role default
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_type, account_type)
);

COMMENT ON TABLE user_commission_overrides IS 'Per-user commission rate overrides per account type. If set, takes precedence over role defaults.';

-- ============================================================
-- 3. COMMISSION PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES users(id) ON DELETE SET NULL,
    role_type TEXT NOT NULL DEFAULT 'sales_rep',
    account_type TEXT, -- 'wholesaler' or 'distributor' of the ordering account
    order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_commission_payments_order ON commission_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_user ON commission_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_commission_payments_period ON commission_payments(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_commission_payments_status ON commission_payments(status);

-- ============================================================
-- 4. ENABLE RLS
-- ============================================================
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_commission_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rules_admin_all"
    ON commission_rules FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "commission_payments_admin_all"
    ON commission_payments FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "commission_payments_user_own"
    ON commission_payments FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_commission_overrides_admin_all"
    ON user_commission_overrides FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    ) WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "user_commission_overrides_user_own"
    ON user_commission_overrides FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- 5. HELPER: Get effective commission rate for a user
-- Tries: user-specific per-account-type > user-specific all > role per-account-type > role all
-- ============================================================
CREATE OR REPLACE FUNCTION get_commission_rate_for_user(
    p_user_id UUID,
    p_role_type TEXT DEFAULT 'sales_rep',
    p_account_type TEXT DEFAULT 'all'
)
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_rate NUMERIC(5,2);
BEGIN
    -- 1. User override for specific account type
    SELECT override_rate_percent INTO v_rate
    FROM user_commission_overrides
    WHERE user_id = p_user_id AND role_type = p_role_type AND account_type = p_account_type;
    IF v_rate IS NOT NULL THEN RETURN v_rate; END IF;

    -- 2. User override for 'all' account types
    SELECT override_rate_percent INTO v_rate
    FROM user_commission_overrides
    WHERE user_id = p_user_id AND role_type = p_role_type AND account_type = 'all';
    IF v_rate IS NOT NULL THEN RETURN v_rate; END IF;

    -- 3. Role default for specific account type
    SELECT rate_percent INTO v_rate
    FROM commission_rules
    WHERE role = p_role_type AND account_type = p_account_type;
    IF v_rate IS NOT NULL THEN RETURN v_rate; END IF;

    -- 4. Role default for 'all' account types
    SELECT rate_percent INTO v_rate
    FROM commission_rules
    WHERE role = p_role_type AND account_type = 'all';
    IF v_rate IS NOT NULL THEN RETURN v_rate; END IF;

    -- Fallback
    RETURN 0;
END;
$$;

-- ============================================================
-- 6. MAIN: Generate commissions for an order
-- ============================================================
CREATE OR REPLACE FUNCTION generate_commissions_for_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_record RECORD;
    v_account_role TEXT;
    v_rep_id UUID;
    v_manager_id UUID;
    v_rep_rate NUMERIC(5,2);
    v_mgr_rate NUMERIC(5,2);
    v_rep_amount NUMERIC(10,2);
    v_mgr_amount NUMERIC(10,2);
    v_period_year INTEGER;
    v_period_month INTEGER;
BEGIN
    -- Get order details
    SELECT o.id, o.user_id, o.total, o.created_at
    INTO v_order_record
    FROM orders o
    WHERE o.id = p_order_id;

    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Check if commissions already generated
    IF EXISTS (SELECT 1 FROM commission_payments WHERE order_id = p_order_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Commissions already generated');
    END IF;

    -- Get the account type (wholesaler/distributor) of the ordering user
    SELECT role INTO v_account_role
    FROM users WHERE id = v_order_record.user_id;

    -- Normalize: only 'distributor' gets special treatment, everything else is 'wholesaler'
    IF v_account_role IS NULL OR v_account_role != 'distributor' THEN
        v_account_role := 'wholesaler';
    END IF;

    -- Get rep assignment for this account
    SELECT rep_id INTO v_rep_id
    FROM rep_account_assignments
    WHERE account_id = v_order_record.user_id;

    IF v_rep_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'No rep assigned, no commissions');
    END IF;

    -- Get manager for this rep
    SELECT manager_id INTO v_manager_id
    FROM users
    WHERE id = v_rep_id;

    -- Calculate period
    v_period_year := EXTRACT(YEAR FROM v_order_record.created_at)::INTEGER;
    v_period_month := EXTRACT(MONTH FROM v_order_record.created_at)::INTEGER;

    -- Get effective rates (user override > role default, per account type)
    v_rep_rate := get_commission_rate_for_user(v_rep_id, 'sales_rep', v_account_role);
    v_mgr_rate := COALESCE(get_commission_rate_for_user(v_manager_id, 'sales_manager', v_account_role), 0);

    -- Calculate amounts
    v_rep_amount := ROUND((v_order_record.total * v_rep_rate / 100), 2);
    v_mgr_amount := CASE WHEN v_manager_id IS NOT NULL
                         THEN ROUND((v_order_record.total * v_mgr_rate / 100), 2)
                         ELSE 0 END;

    -- Insert rep commission
    INSERT INTO commission_payments (
        order_id, user_id, account_id, role_type, account_type,
        order_amount, rate_percent, amount,
        period_year, period_month, status, notes
    ) VALUES (
        p_order_id, v_rep_id, v_order_record.user_id, 'sales_rep', v_account_role,
        v_order_record.total, v_rep_rate, v_rep_amount,
        v_period_year, v_period_month, 'pending',
        format('Auto-generated: %s account at %s%%', v_account_role, v_rep_rate)
    );

    -- Insert manager commission
    IF v_manager_id IS NOT NULL THEN
        INSERT INTO commission_payments (
            order_id, user_id, account_id, role_type, account_type,
            order_amount, rate_percent, amount,
            period_year, period_month, status, notes
        ) VALUES (
            p_order_id, v_manager_id, v_order_record.user_id, 'sales_manager', v_account_role,
            v_order_record.total, v_mgr_rate, v_mgr_amount,
            v_period_year, v_period_month, 'pending',
            format('Manager override: %s account at %s%%', v_account_role, v_mgr_rate)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'rep_id', v_rep_id,
        'rep_rate', v_rep_rate,
        'rep_amount', v_rep_amount,
        'manager_id', v_manager_id,
        'manager_rate', v_mgr_rate,
        'manager_amount', v_mgr_amount,
        'account_type', v_account_role,
        'period', v_period_year || '-' || LPAD(v_period_month::TEXT, 2, '0')
    );
END;
$$;

-- ============================================================
-- 7. RPC WRAPPER
-- ============================================================
CREATE OR REPLACE FUNCTION generate_order_commissions(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN generate_commissions_for_order(p_order_id);
END;
$$;

-- ============================================================
-- 8. RPC: get_all_commissions (bypass RLS for admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_all_commissions()
RETURNS SETOF commission_payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT cp.*
    FROM commission_payments cp
    ORDER BY cp.created_at DESC;
END;
$$;

-- ============================================================
-- 9. RPC: get_user_commissions
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_commissions(p_user_id UUID)
RETURNS SETOF commission_payments
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT cp.*
    FROM commission_payments cp
    WHERE cp.user_id = p_user_id
    ORDER BY cp.created_at DESC;
END;
$$;

-- ============================================================
-- 10. RPC: get_commission_performance
-- ============================================================
CREATE OR REPLACE FUNCTION get_commission_performance(p_role TEXT)
RETURNS TABLE (
    user_id UUID,
    total_commission NUMERIC,
    pending_commission NUMERIC,
    order_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        cp.user_id,
        COALESCE(SUM(cp.amount), 0) AS total_commission,
        COALESCE(SUM(CASE WHEN cp.status = 'pending' THEN cp.amount ELSE 0 END), 0) AS pending_commission,
        COUNT(DISTINCT cp.order_id) AS order_count
    FROM commission_payments cp
    WHERE cp.role_type = p_role
    GROUP BY cp.user_id;
END;
$$;

-- ============================================================
-- 11. SEED DEFAULT COMMISSION RULES
-- 4 rules: Rep-Wholesaler, Rep-Distributor, Manager-Wholesaler, Manager-Distributor
-- ============================================================
INSERT INTO commission_rules (role, account_type, rate_percent, tier, effective_from)
VALUES
    ('sales_rep', 'wholesaler', 10.00, 'standard', NOW()),
    ('sales_rep', 'distributor', 12.00, 'standard', NOW()),
    ('sales_manager', 'wholesaler', 3.00, 'standard', NOW()),
    ('sales_manager', 'distributor', 4.00, 'standard', NOW())
ON CONFLICT (role, account_type) DO UPDATE SET
    rate_percent = EXCLUDED.rate_percent,
    updated_at = NOW();

-- ============================================================
-- 12. TRIGGER: Auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_commission_rules_updated_at
    BEFORE UPDATE ON commission_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_commission_overrides_updated_at
    BEFORE UPDATE ON user_commission_overrides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_commission_payments_updated_at
    BEFORE UPDATE ON commission_payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- DONE! v2 adds account_type (wholesaler/distributor) dimension
-- ============================================================
