-- ============================================================
-- Migration: Update Delivery Fee Logic
-- Date: 2026-04-05
-- Description: Updates the delivery fee to 40 for <=6km, 20/km for 6-12km, and -1 for >12km
-- ============================================================

CREATE OR REPLACE FUNCTION compute_delivery_fee(p_distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_distance_km IS NULL OR p_distance_km <= 0 THEN
    RETURN 40;  -- default base fee
  END IF;
  IF p_distance_km <= 6 THEN
    RETURN 40;
  END IF;
  IF p_distance_km <= 12 THEN
    RETURN 40 + CEIL(p_distance_km - 6) * 20;
  END IF;
  RETURN -1;
END;
$$;
