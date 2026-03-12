-- =====================================================\n-- PHASE 1: NO DIRECT STATUS UPDATE GUARD\n-- Migration: 20260122_no_direct_status_update.sql\n-- Purpose: Prevent direct UPDATE orders.status bypassing state machine\n--\n-- ⚠️ DEPENDENCY: Must run AFTER 20260122_order_state_machine.sql\n-- =====================================================

-- CRITICAL GUARD: Prevents direct status updates
-- All status changes MUST go through transition_order_state() RPC
-- 
-- Note: app.bypass_status_check should NEVER be set by application code
-- Only the SECURITY DEFINER function runs as owner and bypasses this
-- Document this for future developers to prevent regressions

-- First, create a helper function to check if we're in a trusted context
CREATE OR REPLACE FUNCTION is_status_update_allowed()
RETURNS BOOLEAN AS $$
BEGIN
  -- Returns true only when called from SECURITY DEFINER function context
  -- Application code calling supabase.from('orders').update() will get false
  RETURN current_setting('app.bypass_status_check', true) = 'true';
END;
$$ LANGUAGE plpgsql STABLE;

-- Drop existing update policy if it exists and recreate with status guard
DO $$ 
BEGIN
  -- Check if policy exists before trying to drop
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'orders' 
    AND policyname = 'Users can update their own orders'
  ) THEN
    DROP POLICY "Users can update their own orders" ON orders;
  END IF;
END $$;

-- Create new policy that allows updates except for status field
-- Status updates are denied unless in SECURITY DEFINER context
CREATE POLICY "Users can update own orders except status"
  ON orders FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    -- If status is unchanged, allow the update
    status = (SELECT o.status FROM orders o WHERE o.id = orders.id)
    -- OR if we're in a trusted function context (SECURITY DEFINER)
    OR current_setting('app.bypass_status_check', true) = 'true'
  );

-- Revoke direct UPDATE on status column from authenticated users
-- The SECURITY DEFINER function runs as owner and bypasses this
REVOKE UPDATE (status) ON orders FROM authenticated;

-- Re-grant UPDATE on other columns (explicitly list non-status columns)
-- This ensures users can still update delivery_address_id, etc.
GRANT UPDATE (
  delivery_address_id,
  rental_start_date,
  rental_end_date,
  delivery_eta,
  rider_distance,
  updated_at
) ON orders TO authenticated;

-- Add comment for documentation
COMMENT ON POLICY "Users can update own orders except status" ON orders IS 
'Phase 1: Users can update their own orders but status changes are blocked.
Status changes MUST go through transition_order_state() RPC.
DO NOT set app.bypass_status_check in application code.';
