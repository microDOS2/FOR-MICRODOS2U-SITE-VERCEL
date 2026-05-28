-- Assign sales reps to accounts
-- Run this in Supabase SQL Editor

-- First, get the IDs (or hardcode them if known)
-- Bob Smith (CA rep) -> GreenLeaf Wellness (CA)
-- Carol White (TX/FL rep) -> Arizona Wellness (AZ)

INSERT INTO rep_account_assignments (rep_id, account_id)
SELECT 
  (SELECT id FROM users WHERE email = 'bob@microdos2.com'),
  (SELECT id FROM users WHERE email = 'greenleaf@example.com')
WHERE NOT EXISTS (
  SELECT 1 FROM rep_account_assignments 
  WHERE rep_id = (SELECT id FROM users WHERE email = 'bob@microdos2.com')
  AND account_id = (SELECT id FROM users WHERE email = 'greenleaf@example.com')
);

INSERT INTO rep_account_assignments (rep_id, account_id)
SELECT 
  (SELECT id FROM users WHERE email = 'bob@microdos2.com'),
  (SELECT id FROM users WHERE email = 'elevate@example.com')
WHERE NOT EXISTS (
  SELECT 1 FROM rep_account_assignments 
  WHERE rep_id = (SELECT id FROM users WHERE email = 'bob@microdos2.com')
  AND account_id = (SELECT id FROM users WHERE email = 'elevate@example.com')
);

INSERT INTO rep_account_assignments (rep_id, account_id)
SELECT 
  (SELECT id FROM users WHERE email = 'carol@microdos2.com'),
  (SELECT id FROM users WHERE email = 'maria@arizonawellness.com')
WHERE NOT EXISTS (
  SELECT 1 FROM rep_account_assignments 
  WHERE rep_id = (SELECT id FROM users WHERE email = 'carol@microdos2.com')
  AND account_id = (SELECT id FROM users WHERE email = 'maria@arizonawellness.com')
);

INSERT INTO rep_account_assignments (rep_id, account_id)
SELECT 
  (SELECT id FROM users WHERE email = 'carol@microdos2.com'),
  (SELECT id FROM users WHERE email = 'sarah@greenhorizonlabs.com')
WHERE NOT EXISTS (
  SELECT 1 FROM rep_account_assignments 
  WHERE rep_id = (SELECT id FROM users WHERE email = 'carol@microdos2.com')
  AND account_id = (SELECT id FROM users WHERE email = 'sarah@greenhorizonlabs.com')
);

INSERT INTO rep_account_assignments (rep_id, account_id)
SELECT 
  (SELECT id FROM users WHERE email = 'carol@microdos2.com'),
  (SELECT id FROM users WHERE email = 'maria@zenithbotanicals.com')
WHERE NOT EXISTS (
  SELECT 1 FROM rep_account_assignments 
  WHERE rep_id = (SELECT id FROM users WHERE email = 'carol@microdos2.com')
  AND account_id = (SELECT id FROM users WHERE email = 'maria@zenithbotanicals.com')
);

INSERT INTO rep_account_assignments (rep_id, account_id)
SELECT 
  (SELECT id FROM users WHERE email = 'carol@microdos2.com'),
  (SELECT id FROM users WHERE email = 'pacific@example.com')
WHERE NOT EXISTS (
  SELECT 1 FROM rep_account_assignments 
  WHERE rep_id = (SELECT id FROM users WHERE email = 'carol@microdos2.com')
  AND account_id = (SELECT id FROM users WHERE email = 'pacific@example.com')
);

-- Done. 6 rep-account assignments created.
