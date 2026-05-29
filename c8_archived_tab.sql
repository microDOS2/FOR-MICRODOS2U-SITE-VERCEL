-- C8: Add archived_at columns for Archived tab support
-- Orders and invoices with archived_at set OR older than 45 days show in Archived tab

-- Add archived_at to orders
ALTER TABLE IF EXISTS orders
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Add archived_at to invoices
ALTER TABLE IF EXISTS invoices
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

-- Create index for efficient archived tab queries
CREATE INDEX IF NOT EXISTS idx_orders_archived_at 
  ON orders(archived_at) 
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_archived_at 
  ON invoices(archived_at) 
  WHERE archived_at IS NOT NULL;

-- Create RPC function for admin to manually archive an order
CREATE OR REPLACE FUNCTION archive_order(p_order_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE orders 
  SET archived_at = now()
  WHERE id = p_order_id
    AND status = 'shipped'
    AND archived_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Create RPC function for admin to manually archive an invoice
CREATE OR REPLACE FUNCTION archive_invoice(p_invoice_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE invoices 
  SET archived_at = now()
  WHERE id = p_invoice_id
    AND status = 'paid'
    AND archived_at IS NULL;
  
  RETURN FOUND;
END;
$$;

-- Grant execute to authenticated users (admin check happens in app)
GRANT EXECUTE ON FUNCTION archive_order(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION archive_invoice(uuid) TO authenticated;
