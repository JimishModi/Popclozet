-- Migration: Add MRP column to products table
-- Description: Stores the Market Retail Price (Market Value) of the item

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mrp DECIMAL(10, 2);

-- Update existing products with a heuristic (e.g. 5x rental_price) if MRP is null
UPDATE public.products SET mrp = rental_price * 5 WHERE mrp IS NULL;
