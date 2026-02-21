-- =====================================================
-- PHASE 2: TELEMETRY CONFIDENCE
-- Migration: 20260122_telemetry_confidence.sql
-- Purpose: Add confidence scoring to rider location telemetry
-- =====================================================

-- Add confidence and source columns to rider_locations
-- These are ADVISORY only - never block delivery on low confidence
ALTER TABLE rider_locations 
ADD COLUMN IF NOT EXISTS accuracy_meters DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION DEFAULT 1.0 
  CHECK (confidence >= 0.0 AND confidence <= 1.0),
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'foreground' 
  CHECK (source IN ('foreground', 'background', 'simulated', 'manual'));

-- Add index for confidence-based queries (Phase 3 fraud detection)
CREATE INDEX IF NOT EXISTS idx_rider_locations_confidence 
  ON rider_locations(confidence) WHERE confidence < 0.5;

-- Add index for source filtering
CREATE INDEX IF NOT EXISTS idx_rider_locations_source 
  ON rider_locations(source);

-- =====================================================
-- CONFIDENCE SCORING RULES (Documented, not enforced)
-- =====================================================
-- High (≥0.8):    Allow transition, no action
-- Medium (0.5-0.8): Allow + flag for review (logged only)
-- Low (<0.5):     Allow + flag + notify ops (rider sees warning)
-- Critical (<0.2): Allow + require manual confirmation
--
-- INVARIANT: Never silently block a delivery due to low confidence
-- =====================================================

COMMENT ON COLUMN rider_locations.confidence IS 
'Telemetry confidence score (0.0-1.0). Advisory only - never blocks delivery.
High ≥0.8, Medium 0.5-0.8, Low <0.5, Critical <0.2';

COMMENT ON COLUMN rider_locations.source IS 
'Telemetry source: foreground (app active), background (OS location), 
simulated (testing), manual (rider-entered)';

COMMENT ON COLUMN rider_locations.accuracy_meters IS 
'GPS accuracy in meters as reported by device. Lower is more accurate.';
