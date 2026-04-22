-- ============================================================
-- Create applications table (run this FIRST before seeding)
-- Go to: https://supabase.com/dashboard/project/fildaxejimuvfrcqmoba/sql/new
-- ============================================================

CREATE TABLE IF NOT EXISTS applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auth_user_id UUID,
    business_name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    city TEXT,
    state TEXT,
    zip TEXT,
    license_number TEXT,
    ein TEXT,
    website TEXT,
    account_type TEXT CHECK (account_type IN ('wholesaler', 'distributor')),
    business_type TEXT,
    volume_estimate TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'more_info_needed')),
    admin_notes TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ,
    reviewed_by UUID
);

-- Enable RLS
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "apps_admin_all" ON applications;
CREATE POLICY "apps_admin_all" ON applications FOR ALL USING (true) WITH CHECK (true);

-- Also create original stores table (backward compatibility)
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    owner_id UUID,
    address TEXT,
    phone TEXT,
    email TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stores_admin_all" ON stores;
CREATE POLICY "stores_admin_all" ON stores FOR ALL USING (true) WITH CHECK (true);

-- Done! Now run the seed script.
