-- =====================================================
-- PHASE 1: ADD ADMIN ROLE
-- Migration: 20260122_add_admin_role.sql
-- Purpose: Extend role enum to include admin
-- =====================================================

-- Add admin role to the profiles role check constraint
-- This is a non-breaking change (existing data remains valid)

-- First drop the existing constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Re-create with admin included
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('customer', 'rider', 'warehouse', 'admin'));

-- Create index on role for faster admin lookups
CREATE INDEX IF NOT EXISTS idx_profiles_role_admin 
  ON profiles(user_id) WHERE role = 'admin';

-- Add RLS policy for admin read access to orders
CREATE POLICY "Admins can read all orders"
  ON orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Add RLS policy for admin read access to rider_locations (aggregated)
CREATE POLICY "Admins can read all rider locations"
  ON rider_locations FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Add comment for documentation
COMMENT ON CONSTRAINT profiles_role_check ON profiles IS 
'Phase 1: Extended to include admin role. Admin = read-only by design.
Overrides deferred to Phase 4+. See transition_order_state() for enforcement.';
