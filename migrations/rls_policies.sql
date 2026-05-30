-- ============================================================
-- RLS Policies for Portal Access
-- Enables authenticated users to read their own data and
-- enables reps/managers to read their assigned accounts' data
-- ============================================================

-- --- USERS TABLE ---
CREATE POLICY IF NOT EXISTS "Users read own profile" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY IF NOT EXISTS "Users read their accounts" ON public.users
  FOR SELECT USING (
    role IN ('wholesaler', 'distributor') AND
    (
      -- Rep can read their assigned accounts
      EXISTS (
        SELECT 1 FROM public.rep_account_assignments
        WHERE rep_account_assignments.account_id = users.id
        AND rep_account_assignments.rep_id = auth.uid()
      )
      OR
      -- Manager can read their territory accounts
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'sales_manager'
      ) AND manager_id IN (
        SELECT id FROM public.users WHERE id = auth.uid() AND role = 'sales_manager'
      )
    )
  );

CREATE POLICY IF NOT EXISTS "Users read their manager" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.manager_id = users.id
    )
  );

CREATE POLICY IF NOT EXISTS "Users read their reps" ON public.users
  FOR SELECT USING (
    manager_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'sales_manager' AND users.manager_id = u.id
    )
  );

CREATE POLICY IF NOT EXISTS "Users read all (admin)" ON public.users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY IF NOT EXISTS "Users update own profile" ON public.users
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- --- ORDERS TABLE ---
CREATE POLICY IF NOT EXISTS "Users read own orders" ON public.orders
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    -- Rep can read orders from assigned accounts
    EXISTS (
      SELECT 1 FROM public.rep_account_assignments
      WHERE rep_account_assignments.account_id = orders.user_id
      AND rep_account_assignments.rep_id = auth.uid()
    )
    OR
    -- Manager can read orders from their territory
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = orders.user_id
      AND users.manager_id = auth.uid()
    )
    OR
    -- Admin can read all
    EXISTS (
      SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY IF NOT EXISTS "Users update own orders" ON public.orders
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- --- INVOICES TABLE ---
CREATE POLICY IF NOT EXISTS "Users read own invoices" ON public.invoices
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    -- Rep can read invoices for their accounts' orders
    EXISTS (
      SELECT 1 FROM public.orders
      JOIN public.rep_account_assignments ON rep_account_assignments.account_id = orders.user_id
      WHERE orders.id = invoices.order_id
      AND rep_account_assignments.rep_id = auth.uid()
    )
    OR
    -- Manager can read invoices for their territory
    EXISTS (
      SELECT 1 FROM public.orders
      JOIN public.users ON users.id = orders.user_id
      WHERE orders.id = invoices.order_id
      AND users.manager_id = auth.uid()
    )
    OR
    -- Admin can read all
    EXISTS (
      SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE POLICY IF NOT EXISTS "Users update own invoices" ON public.invoices
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- --- ORDER_ITEMS TABLE ---
CREATE POLICY IF NOT EXISTS "Users read own order items" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (
        orders.user_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM public.rep_account_assignments
          WHERE rep_account_assignments.account_id = orders.user_id
          AND rep_account_assignments.rep_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.users
          WHERE users.id = orders.user_id
          AND users.manager_id = auth.uid()
        )
        OR
        EXISTS (
          SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
        )
      )
    )
  );

-- --- COMMISSION_PAYMENTS TABLE ---
CREATE POLICY IF NOT EXISTS "Users read own commissions" ON public.commission_payments
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- --- COMMISSION_RULES TABLE (read-only for all authenticated) ---
CREATE POLICY IF NOT EXISTS "Authenticated read commission rules" ON public.commission_rules
  FOR SELECT USING (auth.role() = 'authenticated');

-- --- USER_COMMISSION_OVERRIDES TABLE ---
CREATE POLICY IF NOT EXISTS "Users read own overrides" ON public.user_commission_overrides
  FOR SELECT USING (
    user_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- --- REP_ACCOUNT_ASSIGNMENTS TABLE ---
CREATE POLICY IF NOT EXISTS "Reps read own assignments" ON public.rep_account_assignments
  FOR SELECT USING (
    rep_id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid() AND users.role = 'sales_manager'
      AND rep_account_assignments.rep_id IN (
        SELECT id FROM public.users WHERE manager_id = auth.uid()
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
