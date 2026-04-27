-- ============================================================
-- microDOS(2) Phase 9: Payment Processor Hook — Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. payment_intents table — tracks payment requests
CREATE TABLE IF NOT EXISTS payment_intents (
    id TEXT PRIMARY KEY,
    invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
    order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    currency TEXT DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    processor TEXT DEFAULT 'high_wire_payments',
    mode TEXT DEFAULT 'test',
    processor_token TEXT,
    transaction_id TEXT,
    payment_url TEXT,
    customer_email TEXT,
    description TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    captured_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    failure_message TEXT
);

-- 2. payment_refunds table — tracks refund records
CREATE TABLE IF NOT EXISTS payment_refunds (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'succeeded',
    processor TEXT DEFAULT 'high_wire_payments',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure RLS is enabled
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies — Admin read all
DROP POLICY IF EXISTS "admin_read_payment_intents" ON payment_intents;
CREATE POLICY "admin_read_payment_intents"
    ON payment_intents FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_payment_refunds" ON payment_refunds;
CREATE POLICY "admin_read_payment_refunds"
    ON payment_refunds FOR SELECT
    USING (public.is_admin());

-- 5. Service role / authenticated insert (for PaymentService)
DROP POLICY IF EXISTS "authenticated_insert_payment_intents" ON payment_intents;
CREATE POLICY "authenticated_insert_payment_intents"
    ON payment_intents FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_payment_intents" ON payment_intents;
CREATE POLICY "authenticated_update_payment_intents"
    ON payment_intents FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- 6. Default app_config entries for High Wire Payments
INSERT INTO app_config (key, value, description)
VALUES
    ('payment_processor', 'high_wire_payments', 'Active payment processor: high_wire_payments, stripe, square, authorize_net')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value, description)
VALUES
    ('payment_mode', 'test', 'Payment mode: test or live')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value, description)
VALUES
    ('payment_client_id', '', 'High Wire Payments Client ID / Merchant ID')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value, description)
VALUES
    ('payment_api_key', '', 'High Wire Payments API Key / Secret')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value, description)
VALUES
    ('payment_endpoint_url', '', 'High Wire Payments API base URL')
ON CONFLICT (key) DO NOTHING;

INSERT INTO app_config (key, value, description)
VALUES
    ('payment_webhook_secret', '', 'Webhook verification secret for payment processor')
ON CONFLICT (key) DO NOTHING;

-- 7. Verify
SELECT 'payment_intents table' as check_item, count(*) as count FROM information_schema.tables WHERE table_name = 'payment_intents';
SELECT 'payment_refunds table' as check_item, count(*) as count FROM information_schema.tables WHERE table_name = 'payment_refunds';
SELECT 'app_config payment entries' as check_item, count(*) as count FROM app_config WHERE key LIKE 'payment_%';
