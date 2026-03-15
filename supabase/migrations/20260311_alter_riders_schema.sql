-- =====================================================
-- ALTER RIDERS SCHEMA TO ADD MISSING COLUMNS
-- =====================================================

-- The riders table was originally created on March 10th without the required 
-- columns for the Rider App (like status, vehicle_type, etc).
-- Because our previous migration used IF NOT EXISTS, it quietly skipped adding them.
-- This script forcefully adds the missing columns.

DO $$ 
BEGIN 
    -- Add user_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='user_id') THEN
        ALTER TABLE public.riders ADD COLUMN user_id UUID REFERENCES public.profiles(user_id) ON DELETE CASCADE;
    END IF;

    -- Add name
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='name') THEN
        ALTER TABLE public.riders ADD COLUMN name TEXT;
    END IF;

    -- Add email
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='email') THEN
        ALTER TABLE public.riders ADD COLUMN email TEXT;
    END IF;

    -- Add avatar_url
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='avatar_url') THEN
        ALTER TABLE public.riders ADD COLUMN avatar_url TEXT;
    END IF;

    -- Add vehicle_type
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='vehicle_type') THEN
        ALTER TABLE public.riders ADD COLUMN vehicle_type TEXT CHECK (vehicle_type IN ('bike', 'scooter', 'car'));
    END IF;

    -- Add vehicle_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='vehicle_number') THEN
        ALTER TABLE public.riders ADD COLUMN vehicle_number TEXT;
    END IF;

    -- Add license_number
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='license_number') THEN
        ALTER TABLE public.riders ADD COLUMN license_number TEXT;
    END IF;

    -- Add status
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='status') THEN
        ALTER TABLE public.riders ADD COLUMN status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy'));
    END IF;

    -- Add rating
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='rating') THEN
        ALTER TABLE public.riders ADD COLUMN rating NUMERIC(3,2) DEFAULT 5.0;
    END IF;

    -- Add total_deliveries
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='total_deliveries') THEN
        ALTER TABLE public.riders ADD COLUMN total_deliveries INTEGER DEFAULT 0;
    END IF;

    -- Add joined_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='joined_at') THEN
        ALTER TABLE public.riders ADD COLUMN joined_at TIMESTAMPTZ DEFAULT NOW();
    END IF;

    -- Add is_verified
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='is_verified') THEN
        ALTER TABLE public.riders ADD COLUMN is_verified BOOLEAN DEFAULT false;
    END IF;

    -- Add updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='riders' AND column_name='updated_at') THEN
        ALTER TABLE public.riders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- Force PostgREST schema cache reload so the Rider app recognizes it immediately
NOTIFY pgrst, 'reload schema';
