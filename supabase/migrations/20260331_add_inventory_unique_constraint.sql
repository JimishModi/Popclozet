-- Migration to add unique constraints
-- Enables reliable upserts in the ingestion scripts

-- 1. Add Unique Constraint to labels (name + brand) in products
-- Ensure no duplicates exist first
DELETE FROM public.products 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM public.products 
    GROUP BY name, brand
);

ALTER TABLE public.products 
DROP CONSTRAINT IF EXISTS unique_product_name_brand;

ALTER TABLE public.products 
ADD CONSTRAINT unique_product_name_brand UNIQUE (name, brand);

-- 2. Add Unique Constraint to inventory (product_id + size)
-- Ensure no duplicates exist first
DELETE FROM public.inventory 
WHERE id NOT IN (
    SELECT MIN(id) 
    FROM public.inventory 
    GROUP BY product_id, size
);

ALTER TABLE public.inventory 
DROP CONSTRAINT IF EXISTS unique_product_size;

ALTER TABLE public.inventory 
ADD CONSTRAINT unique_product_size UNIQUE (product_id, size);

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
