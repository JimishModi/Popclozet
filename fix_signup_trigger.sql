-- Fix for "Failed to create user account / Database error saving new user"
-- The old `profiles` table was deleted, but a trigger was still trying to write to it!
-- Run this in your Supabase SQL Editor to remove the broken trigger:

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Also drop any other outdated triggers that might reference 'profiles'
DROP TRIGGER IF EXISTS trg_sync_profile_role ON public.profiles;
DROP FUNCTION IF EXISTS public.sync_profile_role();
