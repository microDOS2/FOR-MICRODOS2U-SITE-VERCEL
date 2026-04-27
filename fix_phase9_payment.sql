-- ============================================================
-- microDOS(2) Phase 9: Payment Processor Hook — Fix FK types
-- invoice_id and order_id must be UUID to match invoices.id / orders.id
-- ============================================================

-- 1. Drop tables if they exist (we need to recreate with correct types)
DROP TABLE IF EXISTS payment_refunds;
DROP TABLE IF EXISTS payment_intents;

-- 2. payment_intents table — invoice_id and order_id must be UUID
CREATE TABLE IF NOT EXISTS payment_intents (
    id TEXT PRIMARY KEY,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
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

-- 3. payment_refunds table
CREATE TABLE IF NOT EXISTS payment_refunds (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    reason TEXT,
    status TEXT NOT NULL DEFAULT 'succeeded',
    processor TEXT DEFAULT 'high_wire_payments',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. RLS
ALTER TABLE payment_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_payment_intents" ON payment_intents;
CREATE POLICY "admin_read_payment_intents"
    ON payment_intents FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "admin_read_payment_refunds" ON payment_refunds;
CREATE POLICY "admin_read_payment_refunds"
    ON payment_refunds FOR SELECT
    USING (public.is_admin());

DROP POLICY IF EXISTS "authenticated_insert_payment_intents" ON payment_intents;
CREATE POLICY "authenticated_insert_payment_intents"
    ON payment_intents FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_payment_intents" ON payment_intents;
CREATE POLICY "authenticated_update_payment_intents"
    ON payment_intents FOR UPDATE USING (true) WITH CHECK (true);

-- 5. Default config entries
INSERT INTO app_config (key, value, description) VALUES
    ('payment_processor', 'high_wire_payments', 'Active payment processor'),
    ('payment_mode', 'test', 'Payment mode: test or live'),
    ('payment_client_id', '', 'High Wire Client ID / Merchant ID'),
    ('payment_api_key', '', 'High Wire API Key / Secret'),
    ('payment_endpoint_url', '', 'High Wire API base URL'),
    ('payment_webhook_secret', '', 'Webhook verification secret')
ON CONFLICT (key) DO NOTHING;

-- 6. Verify
SELECT 'payment_intents' as check_item, count(*) as count FROM information_schema.tables WHERE table_name = 'payment_intents';
SELECT 'payment_refunds' as check_item, count(*) as count FROM information_schema.tables WHERE table_name = 'payment_refunds';
SELECT 'app_config payment keys' as check_item, count(*) as count FROM app_config WHERE key LIKE 'payment_%';
