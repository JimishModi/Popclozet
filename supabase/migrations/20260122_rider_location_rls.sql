-- =====================================================
-- PHASE 1: RIDER LOCATION RLS
-- Migration: 20260122_rider_location_rls.sql
-- Purpose: Allow riders to insert their own location data
-- =====================================================

-- Allow riders to insert their own location
-- Validates: 1) User is the rider, 2) User has rider role in profiles
CREATE POLICY "Riders can insert their own location"
  ON rider_locations FOR INSERT
  WITH CHECK (
    auth.uid() = rider_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'rider'
    )
  );

-- Allow riders to update their own location (for correction/accuracy updates)
CREATE POLICY "Riders can update their own location"
  ON rider_locations FOR UPDATE
  USING (
    auth.uid() = rider_id AND
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE user_id = auth.uid() 
      AND role = 'rider'
    )
  );

-- Add comment for documentation
COMMENT ON POLICY "Riders can insert their own location" ON rider_locations IS 
'Phase 1: Allows riders to submit location telemetry. Validates role at insert time.';
