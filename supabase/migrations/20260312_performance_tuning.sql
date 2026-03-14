-- PERFORMANCE TUNING: Indexes and Aggregated Views
-- Deploy this to Supabase SQL Editor to fix slow loading in Warehouse App.

-- 1. Essential Indexes for fetching inventory
CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON public.inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_all_products_inventory_id ON public.all_products(inventory_id);
CREATE INDEX IF NOT EXISTS idx_all_products_status ON public.all_products(status);

-- 2. View for Product Stock Summary (Aggregates inventory counts per product)
-- This offloads the heavy aggregation from JS to Postgres.
CREATE OR REPLACE VIEW public.product_stock_summary AS
SELECT 
    p.id,
    p.name,
    p.brand,
    p.category,
    p.images,
    p.rental_price,
    p.is_available,
    COALESCE(SUM(i.available_stock), 0) as total_available,
    COALESCE(SUM(i.went_for_wash), 0) as total_wash,
    COALESCE(SUM(i.available_stock + i.went_for_wash), 0) as total_stock
FROM 
    public.products p
LEFT JOIN 
    public.inventory i ON p.id = i.product_id
GROUP BY 
    p.id;

-- 3. View for Inventory Size Summary (Aggregates physical units per size)
CREATE OR REPLACE VIEW public.inventory_size_summary AS
SELECT 
    i.id,
    i.product_id,
    i.size,
    i.available_stock,
    i.went_for_wash,
    COALESCE(count(ap.individual_id), 0) as unit_count
FROM 
    public.inventory i
LEFT JOIN 
    public.all_products ap ON i.id = ap.inventory_id
GROUP BY 
    i.id;

-- Grant access to the views
GRANT SELECT ON public.product_stock_summary TO anon, authenticated, service_role;
GRANT SELECT ON public.inventory_size_summary TO anon, authenticated, service_role;
