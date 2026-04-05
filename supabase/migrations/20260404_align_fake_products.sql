-- Aligns fake_products schema with the master products table and the Excel simulation data.

DO $$ 
BEGIN 
  -- 1. Rename 'mrp' to 'mrp_price' if it exists.
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fake_products' AND column_name='mrp') THEN
    ALTER TABLE public.fake_products RENAME COLUMN mrp TO mrp_price;
  END IF;

  -- 2. Add missing tiered pricing columns.
  ALTER TABLE public.fake_products ADD COLUMN IF NOT EXISTS rental_price_1d NUMERIC;
  ALTER TABLE public.fake_products ADD COLUMN IF NOT EXISTS rental_price_2d NUMERIC;
  ALTER TABLE public.fake_products ADD COLUMN IF NOT EXISTS rental_price_3d NUMERIC;
  
  -- 3. Add financial/cost columns.
  ALTER TABLE public.fake_products ADD COLUMN IF NOT EXISTS buy_price NUMERIC;
  ALTER TABLE public.fake_products ADD COLUMN IF NOT EXISTS actual_cost NUMERIC;

  -- 4. Ensure deposit_amount is present (it was in the original schema).
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='fake_products' AND column_name='deposit_amount') THEN
    ALTER TABLE public.fake_products ADD COLUMN deposit_amount NUMERIC DEFAULT 0;
  END IF;

END $$;

NOTIFY pgrst, 'reload schema';
