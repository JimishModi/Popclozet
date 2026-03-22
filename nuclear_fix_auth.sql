-- NUCLEAR CLEANUP: Remove all known and unknown triggers on auth.users that break signup
-- Run this in the Supabase SQL Editor

-- 1. Drop known triggers by name
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS create_profile_on_signup ON auth.users;
DROP TRIGGER IF EXISTS handle_new_user_trigger ON auth.users;

-- 2. Drop the functions they usually point to
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.create_profile_for_new_user() CASCADE;

-- 3. DIAGNOSTIC: Run this to see if ANY triggers still exist on auth.users
-- If this returns rows, we missed a trigger name!
SELECT 
    tgname AS trigger_name,
    event_manipulation AS event,
    action_statement AS action
FROM information_schema.triggers 
WHERE event_object_table = 'users' 
  AND event_object_schema = 'auth';

-- 4. Verify customer_profiles exists and is ready
-- (Just a safety check)
SELECT count(*) FROM public.customer_profiles LIMIT 1;
