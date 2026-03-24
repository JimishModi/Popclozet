-- 1. Add column 'eloc' TEXT to public.addresses (nullable, no default)
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS eloc TEXT;

-- 2. Add column 'google_maps_url' TEXT to public.addresses as a GENERATED ALWAYS AS STORED column
ALTER TABLE public.addresses ADD COLUMN IF NOT EXISTS google_maps_url TEXT GENERATED ALWAYS AS (
    'https://maps.google.com/?q=' || latitude || ',' || longitude
) STORED;

-- 3. Add a UNIQUE INDEX on public.rider_locations (rider_id)
-- This enables ON CONFLICT (rider_id) DO UPDATE so each rider has exactly one row updated in place — prevents unbounded table growth as riders publish GPS every 5s.
CREATE UNIQUE INDEX IF NOT EXISTS rider_locations_rider_id_idx ON public.rider_locations (rider_id);
