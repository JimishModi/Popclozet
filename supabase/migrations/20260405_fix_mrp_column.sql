-- Migration to align database columns with the new standards in 'main'
-- This fixes the "column mrp does not exist" error in preview_order RPC

-- 1. Update 'products' table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='mrp_price') THEN
    ALTER TABLE products RENAME COLUMN mrp_price TO mrp;
  END IF;
END $$;

-- 2. Update 'fake_products' table
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fake_products' AND column_name='mrp_price') THEN
    ALTER TABLE fake_products RENAME COLUMN mrp_price TO mrp;
  END IF;
END $$;

-- 3. Ensure all rental tiered pricing columns exist (just in case)
ALTER TABLE products ADD COLUMN IF NOT EXISTS rental_price_1d NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rental_price_2d NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS rental_price_3d NUMERIC;
ALTER TABLE products ADD COLUMN IF NOT EXISTS buy_price NUMERIC;
