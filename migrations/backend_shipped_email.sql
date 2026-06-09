-- Migration: Move shipped email to backend (2025-06-09)
-- Prevents frontend issues from breaking the shipped notification
-- Email now fires from mark_order_shipped RPC + order update trigger

-- 1. Enable pg_net for HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Update mark_order_shipped to send email
CREATE OR REPLACE FUNCTION public.mark_order_shipped(
  p_order_id UUID,
  p_tracking_number TEXT,
  p_carrier TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_ref TEXT;
  v_function_url TEXT;
  v_anon_key TEXT;
BEGIN
  UPDATE public.orders
  SET status = 'shipped', tracking_number = p_tracking_number,
      carrier = p_carrier, shipped_date = NOW(), shipped_by = auth.uid()
  WHERE id = p_order_id;

  BEGIN
    v_project_ref := 'fildaxejimuvfrcqmoba';
    v_function_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/send-order-notification';
    v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbGRheGVqaW11dmZyY3Ftb2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDg2OTUsImV4cCI6MjA5MTY4NDY5NX0.Pe3HHtbo1_OiUTSgnq0qGSgzkkcTxRJ01kfOxsv2Gig';

    PERFORM net.http_post(
      url := v_function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key, 'apikey', v_anon_key),
      body := jsonb_build_object('order_id', p_order_id::text, 'status', 'shipped')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Email failed for order %: %', p_order_id, SQLERRM;
  END;
END;
$$;

-- 3. Backup trigger: fires on any orders.status update TO shipped
CREATE OR REPLACE FUNCTION public.trigger_shipped_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_ref TEXT;
  v_function_url TEXT;
  v_anon_key TEXT;
BEGIN
  IF NEW.status = 'shipped' AND OLD.status IS DISTINCT FROM 'shipped' THEN
    BEGIN
      v_project_ref := 'fildaxejimuvfrcqmoba';
      v_function_url := 'https://' || v_project_ref || '.supabase.co/functions/v1/send-order-notification';
      v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZpbGRheGVqaW11dmZyY3Ftb2JhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYxMDg2OTUsImV4cCI6MjA5MTY4NDY5NX0.Pe3HHtbo1_OiUTSgnq0qGSgzkkcTxRJ01kfOxsv2Gig';

      PERFORM net.http_post(
        url := v_function_url,
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_anon_key, 'apikey', v_anon_key),
        body := jsonb_build_object('order_id', NEW.id::text, 'status', 'shipped')
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Trigger email failed for order %: %', NEW.id, SQLERRM;
    END;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS send_shipped_email ON public.orders;
CREATE TRIGGER send_shipped_email
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  WHEN (NEW.status = 'shipped' AND OLD.status IS DISTINCT FROM 'shipped')
  EXECUTE FUNCTION public.trigger_shipped_email();

-- 4. Grants
GRANT USAGE ON SCHEMA net TO authenticated;
GRANT EXECUTE ON FUNCTION net.http_post TO authenticated;
