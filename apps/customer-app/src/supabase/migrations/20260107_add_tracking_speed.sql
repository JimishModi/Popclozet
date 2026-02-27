-- Migration: Add speed field to delivery_tracking table
-- This migration adds the speed field if it doesn't exist (for existing databases)

-- Add speed column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'delivery_tracking' AND column_name = 'speed'
    ) THEN
        ALTER TABLE delivery_tracking ADD COLUMN speed DOUBLE PRECISION;
    END IF;
END $$;

