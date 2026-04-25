-- ============================================================
-- Phase 4: Admin Batch Territory Transfer
-- Run ALL of this in Supabase SQL Editor, then click Run
-- ============================================================

-- 1. Modify trigger to skip during batch transfers
--    Uses session-level flag set by the batch RPC
DROP FUNCTION IF EXISTS handle_rep_manager_change();
CREATE OR REPLACE FUNCTION handle_rep_manager_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment RECORD;
  v_old_manager_name TEXT;
  v_new_manager_name TEXT;
  v_is_batch TEXT;
BEGIN
  -- Skip auto-creating transfers during batch RPC execution
  BEGIN
    v_is_batch := current_setting('app.is_batch_transfer', true);
  EXCEPTION WHEN OTHERS THEN
    v_is_batch := 'false';
  END;
  IF v_is_batch = 'true' THEN
    RETURN NEW;
  END IF;

  -- Only act on sales_rep role changes
  IF NEW.role != 'sales_rep' THEN
    RETURN NEW;
  END IF;

  SELECT business_name INTO v_old_manager_name FROM users WHERE id = OLD.manager_id;
  SELECT business_name INTO v_new_manager_name FROM users WHERE id = NEW.manager_id;

  FOR v_assignment IN
    SELECT * FROM rep_account_assignments WHERE rep_id = NEW.id
  LOOP
    INSERT INTO assignment_transfers (
      rep_id, account_id, old_manager_id, new_manager_id, status, created_at
    ) VALUES (
      NEW.id, v_assignment.account_id, OLD.manager_id, NEW.manager_id, 'pending', NOW()
    );

    INSERT INTO audit_log (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES (
      'transfer_created', 'assignment_transfers', v_assignment.account_id::TEXT,
      jsonb_build_object('rep_id', NEW.id, 'rep_name', NEW.business_name, 'old_manager_id', OLD.manager_id, 'old_manager_name', v_old_manager_name, 'account_id', v_assignment.account_id)::TEXT,
      jsonb_build_object('new_manager_id', NEW.manager_id, 'new_manager_name', v_new_manager_name)::TEXT,
      auth.uid(), NOW()
    );
  END LOOP;

  RETURN NEW;
END;
$$;

-- Recreate trigger
DROP TRIGGER IF EXISTS rep_manager_change_trigger ON users;
CREATE TRIGGER rep_manager_change_trigger
  AFTER UPDATE OF manager_id ON users
  FOR EACH ROW
  WHEN (OLD.manager_id IS DISTINCT FROM NEW.manager_id)
  EXECUTE FUNCTION handle_rep_manager_change();

-- 2. RPC: transfer_accounts_batch
--    Moves N accounts from one manager to another atomically
--    For each account where move_rep=true, also moves rep + creates transfer queue entry
DROP FUNCTION IF EXISTS transfer_accounts_batch(UUID, UUID, UUID[]);
CREATE OR REPLACE FUNCTION transfer_accounts_batch(
  p_source_manager_id UUID,
  p_target_manager_id UUID,
  p_account_ids UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  -- Verify caller is admin
  SELECT role = 'admin' INTO v_is_admin FROM users WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_source_manager_id = p_target_manager_id THEN
    RAISE EXCEPTION 'Source and target manager cannot be the same';
  END IF;

  SELECT business_name INTO v_old_manager_name FROM users WHERE id = p_source_manager_id;
  SELECT business_name INTO v_target_manager_name FROM users WHERE id = p_target_manager_id;

  -- Set batch mode flag to prevent trigger from auto-creating transfers
  PERFORM set_config('app.is_batch_transfer', 'true', true);

  -- Loop through each account
  FOREACH v_account_id IN ARRAY p_account_ids
  LOOP
    -- Get account name
    SELECT business_name INTO v_account_name FROM users WHERE id = v_account_id;

    -- Update account manager
    UPDATE users
    SET manager_id = p_target_manager_id
    WHERE id = v_account_id
      AND manager_id = p_source_manager_id;

    v_moved_accounts := v_moved_accounts + 1;

    -- Audit: account moved
    INSERT INTO audit_log (action, table_name, record_id, old_data, new_data, user_id, created_at)
    VALUES (
      'account_transferred', 'users', v_account_id::TEXT,
      jsonb_build_object('manager_id', p_source_manager_id, 'manager_name', v_old_manager_name)::TEXT,
      jsonb_build_object('manager_id', p_target_manager_id, 'manager_name', v_target_manager_name)::TEXT,
      auth.uid(), NOW()
    );
  END LOOP;

  -- Clear batch flag
  PERFORM set_config('app.is_batch_transfer', 'false', true);

  RETURN jsonb_build_object(
    'moved_accounts', v_moved_accounts,
    'moved_reps', v_moved_reps,
    'transfer_count', v_transfer_count,
    'cross_territory_count', v_cross_territory_count
  );
END;
$$;

-- 3. RPC: transfer_accounts_batch_with_reps
--    Same as above but accepts rep move flags per account
DROP FUNCTION IF EXISTS transfer_accounts_batch_with_reps(UUID, UUID, UUID[], UUID[]);
CREATE OR REPLACE FUNCTION transfer_accounts_batch_with_reps(
  p_source_manager_id UUID,
  p_target_manager_id UUID,
  p_account_ids UUID[],
  p_rep_ids_to_move UUID[]  -- parallel array, NULL = don't move rep
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
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
  v_i INT;
  v_is_admin BOOLEAN;
BEGIN
  SELECT role = 'admin' INTO v_is_admin FROM users WHERE id = auth.uid();
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin only';
  END IF;

  IF p_source_manager_id = p_target_manager_id THEN
    RAISE EXCEPTION 'Source and target manager cannot be the same';
  END IF;

  IF array_length(p_account_ids, 1) IS NULL OR
     array_length(p_account_ids, 1) != coalesce(array_length(p_rep_ids_to_move, 1), 0) THEN
    RAISE EXCEPTION 'account_ids and rep_ids_to_move arrays must be same length';
  END IF;

  SELECT business_name INTO v_old_manager_name FROM users WHERE id = p_source_manager_id;
  SELECT business_name INTO v_target_manager_name FROM users WHERE id = p_target_manager_id;

  PERFORM set_config('app.is_batch_transfer', 'true', true);

  FOR v_i IN 1..array_length(p_account_ids, 1)
  LOOP
    v_account_id := p_account_ids[v_i];
    v_rep_id := p_rep_ids_to_move[v_i];

    SELECT business_name INTO v_account_name FROM users WHERE id = v_account_id;

    -- Move account
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

    -- Move rep if specified
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

      -- Create transfer queue entry for the new manager
      INSERT INTO assignment_transfers (
        rep_id, account_id, old_manager_id, new_manager_id, status, created_at
      ) VALUES (
        v_rep_id, v_account_id, p_source_manager_id, p_target_manager_id, 'pending', NOW()
      );

      v_transfer_count := v_transfer_count + 1;
    ELSE
      -- Rep stays but account moved = cross-territory
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

-- 4. Grant execute
GRANT EXECUTE ON FUNCTION transfer_accounts_batch(UUID, UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_accounts_batch(UUID, UUID, UUID[]) TO anon;
GRANT EXECUTE ON FUNCTION transfer_accounts_batch_with_reps(UUID, UUID, UUID[], UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_accounts_batch_with_reps(UUID, UUID, UUID[], UUID[]) TO anon;
