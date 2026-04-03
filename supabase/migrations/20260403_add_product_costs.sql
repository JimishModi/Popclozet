-- Migration: Add mrp_price and actual_cost to products table
-- Ensures financial data can be globally set per-product.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS mrp_price NUMERIC(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS actual_cost NUMERIC(10,2);

-- Update the sync_all_products_on_product_update trigger/function to also sync these to new inventory items?
-- Currently, all_products takes mrp_price and actual_cost manually upon addStockToInventory.
-- So we don't strictly need a trigger right now unless we want to backfill all physical units.

NOTIFY pgrst, 'reload schema';
