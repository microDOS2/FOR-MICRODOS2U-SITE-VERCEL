-- ============================================================
-- C7c: Order/Invoice Cancellation & Deletion
-- Run in Supabase SQL Editor
-- ============================================================

-- 1. Add cancellation tracking to orders
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS cancelled_reason TEXT,
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancelled_by UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. Add soft-delete for user-visible records
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS visible_to_user BOOLEAN DEFAULT true;

ALTER TABLE invoices
    ADD COLUMN IF NOT EXISTS visible_to_user BOOLEAN DEFAULT true;

COMMENT ON COLUMN invoices.visible_to_user IS 'When false, invoice is hidden from business user portal but visible to admin';

-- 3. RPC: Cancel an order (cascades to invoice and commissions)
CREATE OR REPLACE FUNCTION cancel_order(
    p_order_id UUID,
    p_reason TEXT DEFAULT 'Cancelled by user'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order_record RECORD;
    v_user_id UUID;
    v_result JSONB;
BEGIN
    -- Get auth user
    v_user_id := auth.uid();

    -- Get order details
    SELECT * INTO v_order_record
    FROM orders WHERE id = p_order_id;

    IF v_order_record IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Order not found');
    END IF;

    -- Only pending orders can be cancelled by business users
    -- Admins can cancel pending or processing
    IF v_order_record.status NOT IN ('pending', 'processing') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot cancel order with status: ' || v_order_record.status);
    END IF;

    -- Business users can only cancel their own orders
    IF v_order_record.user_id != v_user_id THEN
        -- Check if user is admin
        IF NOT EXISTS (SELECT 1 FROM users WHERE id = v_user_id AND role = 'admin') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Not authorized to cancel this order');
        END IF;
    END IF;

    -- Update order status
    UPDATE orders SET
        status = 'cancelled',
        cancelled_reason = p_reason,
        cancelled_at = NOW(),
        cancelled_by = v_user_id
    WHERE id = p_order_id;

    -- Cancel linked invoice
    UPDATE invoices SET
        status = 'cancelled',
        visible_to_user = true
    WHERE order_id = p_order_id
      AND status = 'pending';

    -- Void any pending commissions for this order
    DELETE FROM commission_payments
    WHERE order_id = p_order_id
      AND status = 'pending';

    -- Mark approved/paid commissions as cancelled for review
    UPDATE commission_payments
    SET status = 'cancelled',
        notes = COALESCE(notes, '') || ' | Order cancelled: ' || p_reason
    WHERE order_id = p_order_id
      AND status IN ('approved', 'paid');

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'status', 'cancelled',
        'reason', p_reason
    );
END;
$$;

-- 4. RPC: Soft delete (archive) a cancelled order for a user
CREATE OR REPLACE FUNCTION archive_user_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Verify user owns this order and it's cancelled
    IF NOT EXISTS (
        SELECT 1 FROM orders
        WHERE id = p_order_id
          AND user_id = v_user_id
          AND status = 'cancelled'
    ) THEN
        RETURN false;
    END IF;

    -- Hide order and linked invoice from user
    UPDATE orders SET visible_to_user = false WHERE id = p_order_id;
    UPDATE invoices SET visible_to_user = false WHERE order_id = p_order_id;

    RETURN true;
END;
$$;

-- 5. RPC: Soft delete (archive) a paid invoice for a user
CREATE OR REPLACE FUNCTION archive_user_invoice(p_invoice_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Verify user owns this invoice and it's paid
    IF NOT EXISTS (
        SELECT 1 FROM invoices
        WHERE id = p_invoice_id
          AND user_id = v_user_id
          AND status = 'paid'
    ) THEN
        RETURN false;
    END IF;

    UPDATE invoices SET visible_to_user = false
    WHERE id = p_invoice_id;

    RETURN true;
END;
$$;

-- 6. RPC: Admin hard delete (permanent removal)
CREATE OR REPLACE FUNCTION admin_delete_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify caller is admin
    IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin') THEN
        RETURN false;
    END IF;

    -- Delete commissions
    DELETE FROM commission_payments WHERE order_id = p_order_id;
    -- Delete order items
    DELETE FROM order_items WHERE order_id = p_order_id;
    -- Delete invoices
    DELETE FROM invoices WHERE order_id = p_order_id;
    -- Delete store visits if any
    DELETE FROM store_visits WHERE order_id = p_order_id;
    -- Delete order
    DELETE FROM orders WHERE id = p_order_id;

    RETURN true;
END;
$$;

-- 7. Update existing queries to respect visible_to_user
-- (Frontend will add .eq('visible_to_user', true) for business users)

-- ============================================================
-- DONE! C7c cancellation system ready.
-- ============================================================
