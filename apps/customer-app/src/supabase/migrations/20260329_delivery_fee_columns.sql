-- Migration to add dynamic delivery fee tracking columns to the profiles table
-- Fee is calculated via MapMyIndia Distance API and saved per-user based on their selected address.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS delivery_fee integer DEFAULT 40,
  ADD COLUMN IF NOT EXISTS delivery_distance_km numeric(6,2),
  ADD COLUMN IF NOT EXISTS delivery_estimate text DEFAULT '15min';

-- Note: User needs to apply this via Supabase SQL Editor manually.
