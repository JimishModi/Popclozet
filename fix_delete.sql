-- Fix "Failed to delete" error in Supabase Authentication Dashboard by adding ON DELETE CASCADE to customer_profiles
-- Run this in your Supabase SQL Editor

ALTER TABLE public.customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_id_fkey;
ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.customer_profiles DROP CONSTRAINT IF EXISTS customer_profiles_user_id_fkey;
ALTER TABLE public.customer_profiles ADD CONSTRAINT customer_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
