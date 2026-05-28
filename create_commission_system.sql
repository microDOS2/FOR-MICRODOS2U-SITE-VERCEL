-- ============================================================
-- microDOS(2) Commission System Migration
-- Run in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/fildaxejimuvfrcqmoba/sql/new
-- ============================================================

-- ============================================================
-- 1. COMMISSION RULES TABLE (Default rates per role)
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL UNIQUE, -- 'sales_rep' or 'sales_manager'
    rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0, -- e.g., 10.00 = 10%
    tier TEXT NOT NULL DEFAULT 'standard',
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE commission_rules IS 'Default commission rates per role. Admin-configurable.';
COMMENT ON COLUMN commission_rules.rate_percent IS 'Percentage of order total earned as commission (e.g., 10.00 = 10%)';

-- ============================================================
-- 2. USER COMMISSION OVERRIDES TABLE (Per-user rate overrides)
-- ============================================================
CREATE TABLE IF NOT EXISTS user_commission_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_type TEXT NOT NULL DEFAULT 'sales_rep', -- 'sales_rep' or 'sales_manager' (which role this override applies to)
    override_rate_percent NUMERIC(5,2), -- NULL = use role default, otherwise use this value
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_type)
);

COMMENT ON TABLE user_commission_overrides IS 'Per-user commission rate overrides. If set, takes precedence over role defaults.';

-- ============================================================
-- 3. COMMISSION PAYMENTS TABLE (Calculated commission entries)
-- ============================================================
CREATE TABLE IF NOT EXISTS commission_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- the person earning this commission (rep or manager)
    account_id UUID REFERENCES users(id) ON DELETE SET NULL, -- the customer account that placed the order
    role_type TEXT NOT NULL DEFAULT 'sales_rep', -- 'sales_rep' or 'sales_manager' earning this payment
    order_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    rate_percent NUMERIC(5,2) NOT NULL DEFAULT 0, -- the rate that was applied (for audit)
    amount NUMERIC(10,2) NOT NULL DEFAULT 0, -- calculated commission amount
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'paid', 'cancelled'
    approved_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE commission_payments IS 'Individual commission payment records generated when orders are paid.';
COMMENT ON COLUMN commission_payments.status IS 'pending=accrued, approved=processing, paid=paid out';

-- Create index for fast lookups
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

-- Admin-only policies (commission data is sensitive)
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

-- Allow users to see their own overrides (read-only)
CREATE POLICY "user_commission_overrides_user_own"
    ON user_commission_overrides FOR SELECT USING (user_id = auth.uid());

-- ============================================================
-- 5. HELPER FUNCTION: Get effective commission rate for a user
-- ============================================================
CREATE OR REPLACE FUNCTION get_commission_rate_for_user(p_user_id UUID, p_role_type TEXT DEFAULT 'sales_rep')
RETURNS NUMERIC(5,2)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_override_rate NUMERIC(5,2);
    v_default_rate NUMERIC(5,2);
BEGIN
    -- First check for user-specific override
    SELECT override_rate_percent INTO v_override_rate
    FROM user_commission_overrides
    WHERE user_id = p_user_id AND role_type = p_role_type;

    -- If override exists, use it
    IF v_override_rate IS NOT NULL THEN
        RETURN v_override_rate;
    END IF;

    -- Otherwise, fall back to role default
    SELECT rate_percent INTO v_default_rate
    FROM commission_rules
    WHERE role = p_role_type;

    RETURN COALESCE(v_default_rate, 0);
END;
$$;

-- ============================================================
-- 6. MAIN FUNCTION: Generate commissions for an order
-- Called automatically when order is marked as paid
-- ============================================================
CREATE OR REPLACE FUNCTION generate_commissions_for_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_record RECORD;
    v_rep_id UUID;
    v_manager_id UUID;
    v_rep_rate NUMERIC(5,2);
    v_mgr_rate NUMERIC(5,2);
    v_rep_amount NUMERIC(10,2);
    v_mgr_amount NUMERIC(10,2);
    v_period_year INTEGER;
    v_period_month INTEGER;
    v_result JSONB;
BEGIN
    -- Get order details
    SELECT o.id, o.user_id, o.total, o.created_at
    INTO v_order_record
    FROM orders o
    WHERE o.id = p_order_id;

    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Check if commissions already generated for this order
    IF EXISTS (SELECT 1 FROM commission_payments WHERE order_id = p_order_id) THEN
        RETURN jsonb_build_object('success', false, 'error', 'Commissions already generated for this order');
    END IF;

    -- Get rep assignment for this account (the customer who placed the order)
    SELECT rep_id INTO v_rep_id
    FROM rep_account_assignments
    WHERE account_id = v_order_record.user_id;

    -- If no rep assigned, no commissions generated
    IF v_rep_id IS NULL THEN
        RETURN jsonb_build_object('success', true, 'message', 'No rep assigned to this account, no commissions generated');
    END IF;

    -- Get the manager for this rep
    SELECT manager_id INTO v_manager_id
    FROM users
    WHERE id = v_rep_id;

    -- Calculate period from order date
    v_period_year := EXTRACT(YEAR FROM v_order_record.created_at)::INTEGER;
    v_period_month := EXTRACT(MONTH FROM v_order_record.created_at)::INTEGER;

    -- Get effective rates (checks user overrides first, then role defaults)
    v_rep_rate := get_commission_rate_for_user(v_rep_id, 'sales_rep');
    v_mgr_rate := COALESCE(get_commission_rate_for_user(v_manager_id, 'sales_manager'), 0);

    -- Calculate amounts
    v_rep_amount := ROUND((v_order_record.total * v_rep_rate / 100), 2);
    v_mgr_amount := CASE WHEN v_manager_id IS NOT NULL
                         THEN ROUND((v_order_record.total * v_mgr_rate / 100), 2)
                         ELSE 0 END;

    -- Insert rep commission
    INSERT INTO commission_payments (
        order_id, user_id, account_id, role_type,
        order_amount, rate_percent, amount,
        period_year, period_month, status, notes
    ) VALUES (
        p_order_id, v_rep_id, v_order_record.user_id, 'sales_rep',
        v_order_record.total, v_rep_rate, v_rep_amount,
        v_period_year, v_period_month, 'pending',
        'Auto-generated on order payment'
    );

    -- Insert manager commission if manager exists
    IF v_manager_id IS NOT NULL THEN
        INSERT INTO commission_payments (
            order_id, user_id, account_id, role_type,
            order_amount, rate_percent, amount,
            period_year, period_month, status, notes
        ) VALUES (
            p_order_id, v_manager_id, v_order_record.user_id, 'sales_manager',
            v_order_record.total, v_mgr_rate, v_mgr_amount,
            v_period_year, v_period_month, 'pending',
            'Manager override - auto-generated on order payment'
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
        'period', v_period_year || '-' || LPAD(v_period_month::TEXT, 2, '0')
    );
END;
$$;

-- ============================================================
-- 7. RPC WRAPPER: generate_order_commissions
-- Can be called from frontend when marking order as paid
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
-- 8. RPC FUNCTION: get_all_commissions (bypass RLS for admin)
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
-- 9. RPC FUNCTION: get_user_commissions
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
-- 10. RPC FUNCTION: get_commission_performance
-- Returns aggregated commission data per user for the directory
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
-- ============================================================
INSERT INTO commission_rules (role, rate_percent, tier, effective_from)
VALUES
    ('sales_rep', 10.00, 'standard', NOW()),
    ('sales_manager', 3.00, 'standard', NOW())
ON CONFLICT (role) DO UPDATE SET
    rate_percent = EXCLUDED.rate_percent,
    updated_at = NOW();

-- ============================================================
-- 12. TRIGGER: Auto-update updated_at timestamp
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
-- DONE! Commission system is ready.
-- ============================================================
-- Next steps:
-- 1. Update markPaid in OrdersInvoicesPage.tsx and DashboardPage.tsx
--    to call supabase.rpc('generate_order_commissions', { p_order_id: orderId })
-- 2. Add per-user override UI to Admin CommissionsPage
-- ============================================================
