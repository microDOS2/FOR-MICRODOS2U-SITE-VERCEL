-- ============================================================
-- Phase 4 Fix: JSONB-based batch transfer (avoids array serialization issues)
-- Also fixes Phase 3: trigger already has batch guard
-- Run ALL of this in Supabase SQL Editor
-- ============================================================

-- 1. Drop old array-based RPCs
DROP FUNCTION IF EXISTS transfer_accounts_batch_with_reps(UUID, UUID, UUID[], UUID[]);
DROP FUNCTION IF EXISTS transfer_accounts_batch_with_reps(UUID, UUID, TEXT[], TEXT[]);
DROP FUNCTION IF EXISTS transfer_accounts_batch(UUID, UUID, UUID[]);

-- 2. Create JSONB-based RPC
--    p_transfers is a JSONB array: [{"account_id":"uuid","rep_id":"uuid"}, ...]
--    rep_id can be null (cross-territory)
CREATE OR REPLACE FUNCTION transfer_accounts_batch_json(
  p_source_manager_id UUID,
  p_target_manager_id UUID,
  p_transfers JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transfer RECORD;
  v_account_id UUID;
  v_rep_id UUID;
  v_rep_name TEXT;
  v_account_name TEXT;
  v_old_manager_name TEXT;
  v_target_manager_name TEXT;
  v_moved_accounts INT := 0;
  v_moved_reps INT := 0;
  v_transfer_count INT := 0;
  v_cross_territory_count INT := 0;
  v_is_admin BOOLEAN;
BEGIN
  SELECT role = 'admin' INTO v_is_admin FROM users WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_source_manager_id = p_target_manager_id THEN
    RAISE EXCEPTION 'Source and target manager cannot be the same';
  END IF;

  IF p_transfers IS NULL OR jsonb_array_length(p_transfers) = 0 THEN
    RAISE EXCEPTION 'No transfers specified';
  END IF;

  SELECT business_name INTO v_old_manager_name FROM users WHERE id = p_source_manager_id;
  SELECT business_name INTO v_target_manager_name FROM users WHERE id = p_target_manager_id;

  PERFORM set_config('app.is_batch_transfer', 'true', true);

  FOR v_transfer IN
    SELECT 
      (elem->>'account_id')::UUID as account_id,
      NULLIF(elem->>'rep_id', '')::UUID as rep_id
    FROM jsonb_array_elements(p_transfers) as elem
  LOOP
    v_account_id := v_transfer.account_id;
    v_rep_id := v_transfer.rep_id;

    SELECT business_name INTO v_account_name FROM users WHERE id = v_account_id;

    UPDATE users
    SET manager_id = p_target_manager_id
    WHERE id = v_account_id
      AND manager_id = p_source_manager_id;

    v_moved_accounts := v_moved_accounts + 1;

    INSERT INTO audit_log (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES (
      'account_transferred', 'users', v_account_id::TEXT,
      jsonb_build_object('manager_id', p_source_manager_id, 'manager_name', v_old_manager_name)::TEXT,
      jsonb_build_object('manager_id', p_target_manager_id, 'manager_name', v_target_manager_name)::TEXT,
      auth.uid(), NOW()
    );

    IF v_rep_id IS NOT NULL THEN
      SELECT business_name INTO v_rep_name FROM users WHERE id = v_rep_id;

      UPDATE users
      SET manager_id = p_target_manager_id
      WHERE id = v_rep_id;

      v_moved_reps := v_moved_reps + 1;

      INSERT INTO audit_log (action, table_name, record_id, old_data, new_data, user_id, created_at)
      VALUES (
        'rep_transferred', 'users', v_rep_id::TEXT,
        jsonb_build_object('old_manager_id', p_source_manager_id, 'old_manager_name', v_old_manager_name, 'rep_name', v_rep_name)::TEXT,
        jsonb_build_object('new_manager_id', p_target_manager_id, 'new_manager_name', v_target_manager_name)::TEXT,
        auth.uid(), NOW()
      );

      INSERT INTO assignment_transfers (
        rep_id, account_id, old_manager_id, new_manager_id, status, created_at
      ) VALUES (
        v_rep_id, v_account_id, p_source_manager_id, p_target_manager_id, 'pending', NOW()
      );

      v_transfer_count := v_transfer_count + 1;
    ELSE
      v_cross_territory_count := v_cross_territory_count + 1;
    END IF;
  END LOOP;

  PERFORM set_config('app.is_batch_transfer', 'false', true);

  RETURN jsonb_build_object(
    'moved_accounts', v_moved_accounts,
    'moved_reps', v_moved_reps,
    'transfer_count', v_transfer_count,
    'cross_territory_count', v_cross_territory_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION transfer_accounts_batch_json(UUID, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_accounts_batch_json(UUID, UUID, JSONB) TO anon;
