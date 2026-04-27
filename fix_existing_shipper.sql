-- Fix existing shipper@microdos2.com account so they can log in immediately
SELECT confirm_user_email('shipper@microdos2.com');

-- Verify
SELECT email, email_confirmed_at, confirmed_at 
FROM auth.users 
WHERE email = 'shipper@microdos2.com';
