-- Migration: Clean up duplicate mrp/mrp_price columns on products table.
-- History:
--   20260309 added 'mrp' to products
--   20260403 added 'mrp_price' to products (creating a duplicate)
--   20260405 tried to rename mrp_price → mrp, but fails when mrp already exists
-- This migration drops the redundant mrp_price column (if present) after
-- copying any non-null values into mrp.

DO $$
BEGIN
  -- Only act if the duplicate mrp_price column exists
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'mrp_price'
  ) THEN
    -- Copy mrp_price into mrp where mrp is null but mrp_price is not
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'products'
        AND column_name = 'mrp'
    ) THEN
      UPDATE public.products
        SET mrp = mrp_price
        WHERE mrp IS NULL AND mrp_price IS NOT NULL;

      ALTER TABLE public.products DROP COLUMN mrp_price;
    ELSE
      -- mrp doesn't exist, just rename mrp_price to mrp
      ALTER TABLE public.products RENAME COLUMN mrp_price TO mrp;
    END IF;
  END IF;
END $$;

-- Same cleanup for fake_products
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'fake_products'
      AND column_name = 'mrp_price'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'fake_products'
        AND column_name = 'mrp'
    ) THEN
      UPDATE public.fake_products
        SET mrp = mrp_price
        WHERE mrp IS NULL AND mrp_price IS NOT NULL;

      ALTER TABLE public.fake_products DROP COLUMN mrp_price;
    ELSE
      ALTER TABLE public.fake_products RENAME COLUMN mrp_price TO mrp;
    END IF;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
