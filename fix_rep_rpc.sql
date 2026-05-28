-- Update the function to also return manager_id
CREATE OR REPLACE FUNCTION get_rep_for_account(p_account_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rep_record JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', u.id,
    'contact_name', u.contact_name,
    'business_name', u.business_name,
    'email', u.email,
    'phone', u.phone,
    'city', u.city,
    'state', u.state,
    'manager_id', u.manager_id
  ) INTO rep_record
  FROM rep_account_assignments ra
  JOIN users u ON u.id = ra.rep_id
  WHERE ra.account_id = p_account_id
  LIMIT 1;

  RETURN COALESCE(rep_record, 'null'::jsonb);
END;
$$;
