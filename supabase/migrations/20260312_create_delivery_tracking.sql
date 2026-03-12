-- =====================================================
-- CREATE DELIVERY TRACKING TABLE
-- =====================================================

-- This table stores real-time position updates for active deliveries,
-- consumed by the customer app to show the rider's live location.

CREATE TABLE IF NOT EXISTS public.delivery_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    driver_name TEXT,
    vehicle_number TEXT,
    current_lat DOUBLE PRECISION NOT NULL,
    current_lng DOUBLE PRECISION NOT NULL,
    heading DOUBLE PRECISION,
    speed DOUBLE PRECISION,
    eta_minutes INTEGER,
    last_eta_update TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by order_id when active
CREATE INDEX IF NOT EXISTS idx_delivery_tracking_order_active 
ON public.delivery_tracking(order_id) WHERE is_active = true;

-- Enable Row Level Security
ALTER TABLE public.delivery_tracking ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read tracking info for their orders, riders can read any tracking for testing, etc.
-- For simplicity in the app, we allow SELECT on this table for authenticated users.
CREATE POLICY "Allow public read access to delivery tracking"
    ON public.delivery_tracking
    FOR SELECT
    TO public, authenticated
    USING (true);

-- Policy: Authenticated users can insert
CREATE POLICY "Allow authenticated insert to delivery tracking"
    ON public.delivery_tracking
    FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- Policy: Authenticated users can update
CREATE POLICY "Allow authenticated update to delivery tracking"
    ON public.delivery_tracking
    FOR UPDATE
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Trigger to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_delivery_tracking_updated_at') THEN
        CREATE TRIGGER update_delivery_tracking_updated_at
            BEFORE UPDATE ON public.delivery_tracking
            FOR EACH ROW
            EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

-- Force PostgREST schema cache reload so the Customer app recognizes it immediately
NOTIFY pgrst, 'reload schema';
