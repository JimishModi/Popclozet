-- Ensure category_configs table exists
CREATE TABLE IF NOT EXISTS public.category_configs (
    category TEXT PRIMARY KEY,
    display_name TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    sizes TEXT[] NOT NULL DEFAULT ARRAY['XS','S','M','L','XL','XXL'],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only 3 categories: Jackets, Footwear, Accessories

-- Footwear sizes: 34-44 (Indian/EU standard)
INSERT INTO public.category_configs (category, display_name, sizes)
VALUES ('footwear', 'Footwear', ARRAY['34','35','36','37','38','39','40','41','42','43','44'])
ON CONFLICT (category) DO UPDATE SET sizes = EXCLUDED.sizes;

-- Accessories: one size (no size selection needed)
INSERT INTO public.category_configs (category, display_name, sizes)
VALUES ('accessories', 'Accessories', ARRAY['onesize'])
ON CONFLICT (category) DO UPDATE SET sizes = EXCLUDED.sizes;

-- Clean up duplicate/stale categories
DELETE FROM public.category_configs WHERE category IN ('shoes', 'accessory');

-- Migrate any products using old category names to canonical ones
UPDATE public.products SET category = 'footwear' WHERE lower(category) = 'shoes';
UPDATE public.products SET category = 'accessories' WHERE lower(category) = 'accessory';

NOTIFY pgrst, 'reload schema';
