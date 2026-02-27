-- =====================================================
-- COMPLETE CLEAN MIGRATION FOR POPCLOZET
-- Run this ONCE to set up everything correctly
-- =====================================================

-- =====================================================
-- STEP 1: Clean up existing data (optional - only if you want fresh start)
-- =====================================================
-- Uncomment these lines if you want to delete all existing test data:
-- DELETE FROM public.profiles;
-- This will NOT delete auth.users - you need to do that manually in Supabase UI

-- =====================================================
-- STEP 2: Drop existing triggers and functions
-- =====================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- =====================================================
-- STEP 3: Ensure profiles table has correct structure
-- =====================================================
-- Table should already exist from initial migration
-- Just verify the user_id column has UNIQUE constraint
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'profiles_user_id_key'
    ) THEN
        ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_key UNIQUE (user_id);
    END IF;
END $$;

-- =====================================================
-- STEP 4: Update RLS Policies
-- =====================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile during signup" ON profiles;

-- Recreate policies
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = user_id);

-- NO INSERT policy needed - trigger will handle it with SECURITY DEFINER

-- =====================================================
-- STEP 5: Create Auto-Profile Function
-- =====================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert new profile for the user
  INSERT INTO public.profiles (user_id, full_name, phone, role, created_at, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'phone', ''),
    'customer',
    NOW(),
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    -- Profile already exists, ignore
    RETURN NEW;
  WHEN OTHERS THEN
    -- Log error but don't fail user creation
    RAISE WARNING 'Could not create profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

-- =====================================================
-- STEP 6: Create Trigger
-- =====================================================
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =====================================================
-- STEP 7: Sync existing users (create missing profiles)
-- =====================================================
INSERT INTO public.profiles (user_id, full_name, phone, role, created_at, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', ''),
  COALESCE(au.raw_user_meta_data->>'phone', ''),
  'customer',
  NOW(),
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = au.id
)
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================
-- Check if trigger was created
SELECT 
  tgname as trigger_name,
  tgenabled as enabled,
  'Trigger created successfully' as status
FROM pg_trigger 
WHERE tgname = 'on_auth_user_created';

-- Check if function exists
SELECT 
  proname as function_name,
  'Function created successfully' as status
FROM pg_proc 
WHERE proname = 'handle_new_user';

-- Count users vs profiles (should match)
SELECT 
  (SELECT COUNT(*) FROM auth.users) as total_auth_users,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  CASE 
    WHEN (SELECT COUNT(*) FROM auth.users) = (SELECT COUNT(*) FROM public.profiles)
    THEN '✅ All users have profiles'
    ELSE '⚠️ Mismatch - some users missing profiles'
  END as sync_status;

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✅ Migration completed successfully!';
  RAISE NOTICE '📝 Trigger: on_auth_user_created is active';
  RAISE NOTICE '🔐 RLS policies updated';
  RAISE NOTICE '👥 Existing users synced with profiles';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 You can now:';
  RAISE NOTICE '   1. Sign up new users - profiles will be created automatically';
  RAISE NOTICE '   2. Existing users can log in';
  RAISE NOTICE '   3. All authentication should work correctly';
END $$;
