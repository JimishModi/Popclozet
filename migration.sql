-- Migration script to remove the `profiles` table and fix dependencies
-- Run this in the Supabase SQL Editor

-- 1. Drop foreign key constraints that reference `profiles`
ALTER TABLE public.legal_acceptances DROP CONSTRAINT IF EXISTS legal_acceptances_user_id_fkey;
ALTER TABLE public.rider_notifications DROP CONSTRAINT IF EXISTS rider_notifications_rider_id_fkey;
ALTER TABLE public.riders DROP CONSTRAINT IF EXISTS riders_user_id_fkey;
ALTER TABLE public.user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_user_id_fkey;

-- 2. Clean up orphaned rows before applying new constraints
DELETE FROM public.legal_acceptances 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM public.customer_profiles);

DELETE FROM public.rider_notifications 
WHERE rider_id IS NOT NULL AND rider_id NOT IN (SELECT user_id FROM public.rider_profiles);

DELETE FROM public.riders 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM public.rider_profiles);

DELETE FROM public.user_subscriptions 
WHERE user_id IS NOT NULL AND user_id NOT IN (SELECT user_id FROM public.customer_profiles);

-- 3. Re-create foreign key constraints to point to the correct role-specific tables

-- legal_acceptances: Assume these are customers accepting terms
ALTER TABLE public.legal_acceptances 
  ADD CONSTRAINT legal_acceptances_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.customer_profiles(user_id) ON DELETE CASCADE;

-- rider_notifications: Point to rider_profiles
ALTER TABLE public.rider_notifications 
  ADD CONSTRAINT rider_notifications_rider_id_fkey 
  FOREIGN KEY (rider_id) REFERENCES public.rider_profiles(user_id) ON DELETE CASCADE;

-- riders: Point to rider_profiles (if user_id refers to the auth user id)
ALTER TABLE public.riders 
  ADD CONSTRAINT riders_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.rider_profiles(user_id) ON DELETE CASCADE;

-- user_subscriptions: Assume these are customer subscriptions
ALTER TABLE public.user_subscriptions 
  ADD CONSTRAINT user_subscriptions_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES public.customer_profiles(user_id) ON DELETE CASCADE;

-- 3. Drop any views or functions that might depend on `profiles`
-- (Add explicit DROP VIEW / DROP FUNCTION here if you have custom ones failing the table drop)
-- Example: DROP VIEW IF EXISTS user_details_view;

-- 4. Drop the `profiles` table
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Note: The CASCADE option on DROP TABLE will automatically drop the triggers and foreign keys 
-- owned by the table, as well as any views depending directly on the table.
