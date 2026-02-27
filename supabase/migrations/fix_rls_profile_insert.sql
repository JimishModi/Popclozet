-- Fix RLS Policy for Profile Creation During Signup
-- Run this in Supabase SQL Editor

-- Add policy to allow users to insert their own profile during signup
CREATE POLICY "Users can insert their own profile during signup"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = user_id);
