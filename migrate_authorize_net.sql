-- ============================================================================
-- Authorize.net Integration Migration
-- Run this in Supabase SQL Editor after deploying the authorize-net-charge
-- Edge Function and the frontend build.
-- ============================================================================

-- 1. Set default payment processor to authorize_net with test mode
INSERT INTO public.app_config (key, value, description)
VALUES
  ('payment_processor', 'authorize_net', 'Active payment processor'),
  ('payment_mode', 'test', 'Payment mode: test (sandbox) or live'),
  ('payment_client_id', '', 'Authorize.net API Login ID'),
  ('payment_api_key', '', 'Authorize.net Transaction Key (server-side only)'),
  ('payment_public_client_key', '', 'Authorize.net Public Client Key for Accept.js'),
  ('payment_endpoint_url', 'https://apitest.authorize.net/xml/v1/request.api', 'Authorize.net API endpoint (auto-set by mode)'),
  ('payment_webhook_secret', '', 'Webhook secret for payment notifications')
ON CONFLICT (key) DO NOTHING;

-- 2. Set Edge Function secrets (run via Supabase CLI or Dashboard)
-- These are NOT stored in the database — they are edge function secrets.
-- Use the Supabase Dashboard or CLI:
--
--   supabase secrets set --project-ref fildaxejimuvfrcqmoba AUTHORIZE_NET_API_LOGIN_ID='67P2t5yKj'
--   supabase secrets set --project-ref fildaxejimuvfrcqmoba AUTHORIZE_NET_TRANSACTION_KEY='47Jq4Un5z965A5N8'
--   supabase secrets set --project-ref fildaxejimuvfrcqmoba AUTHORIZE_NET_MODE='test'
--
-- Or use the Dashboard: Project Settings > Edge Functions > Secrets

-- 3. Verify
SELECT key, value, description FROM public.app_config WHERE key LIKE 'payment_%' ORDER BY key;
