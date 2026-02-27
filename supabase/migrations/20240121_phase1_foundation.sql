-- Phase 1: Foundation Infrastructure Migration
-- Description: Sets up PostGIS, Core Schema, and Audit Logging

-- 1. Enable PostGIS Extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS timescaledb; -- Attempt to enable if available

-- 2. User Addresses (Permanent Geocoding Cache)
CREATE TABLE IF NOT EXISTS public.addresses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    label TEXT NOT NULL, -- e.g., "Home", "Work"
    full_address TEXT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326), -- Geospatial column for PostGIS calculations
    geohash TEXT GENERATED ALWAYS AS (st_geohash(st_setsrid(st_makepoint(longitude, latitude), 4326))) STORED,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_addresses_location ON public.addresses USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_addresses_user_id ON public.addresses(user_id);

-- 3. State Machine Audit Log
CREATE TABLE IF NOT EXISTS public.order_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    previous_status TEXT,
    new_status TEXT NOT NULL,
    changed_by UUID REFERENCES auth.users(id), -- User or System (NULL)
    metadata JSONB DEFAULT '{}'::jsonb, -- Store "reason", "location" at time of change
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_audit_order_id ON public.order_audit_log(order_id);

-- 4. Rider Breadcrumbs (Time-Series Data)
-- Designed to be compatible with TimescaleDB hypertables
CREATE TABLE IF NOT EXISTS public.rider_breadcrumbs (
    time TIMESTAMPTZ NOT NULL,
    rider_id UUID NOT NULL REFERENCES auth.users(id),
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location GEOGRAPHY(POINT, 4326),
    speed DOUBLE PRECISION,
    accuracy DOUBLE PRECISION,
    battery_level INTEGER
);

-- Convert to hypertable if TimescaleDB is present (Graceful fallback)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        PERFORM create_hypertable('rider_breadcrumbs', 'time', if_not_exists => TRUE);
        
        -- Add compression policy (Data older than 7 days)
        ALTER TABLE rider_breadcrumbs SET (
            timescaledb.compress,
            timescaledb.compress_segmentby = 'rider_id'
        );
        SELECT add_compression_policy('rider_breadcrumbs', INTERVAL '7 days');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'TimescaleDB not available or configuration failed. Using standard table.';
END $$;

CREATE INDEX IF NOT EXISTS idx_breadcrumbs_rider_time ON public.rider_breadcrumbs(rider_id, time DESC);

-- 5. Orders Table Updates (Ensure Geospatial Columns)
-- Add geospatial columns if they don't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='delivery_location') THEN
        ALTER TABLE public.orders ADD COLUMN delivery_location GEOGRAPHY(POINT, 4326);
    END IF;
END $$;

-- Trigger to sync lat/long to geography column for Addresses
CREATE OR REPLACE FUNCTION public.sync_address_location()
RETURNS TRIGGER AS $$
BEGIN
    NEW.location := st_setsrid(st_makepoint(NEW.longitude, NEW.latitude), 4326);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_address_location ON public.addresses;
CREATE TRIGGER trg_sync_address_location
    BEFORE INSERT OR UPDATE OF latitude, longitude ON public.addresses
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_address_location();
