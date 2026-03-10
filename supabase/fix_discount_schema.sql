-- EMERGENCY FIX: Drop and Recreate Product Discounts Table
-- Use this if you get "column does not exist" errors

-- 1. Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_product_discounts_updated_at ON public.product_discounts;

-- 2. Drop existing table
DROP TABLE IF EXISTS public.product_discounts;

-- 3. Re-create the helper function (just in case)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Create the table with the CORRECT schema
CREATE TABLE public.product_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Add indexes
CREATE INDEX idx_product_discounts_product_id ON public.product_discounts(product_id);
CREATE INDEX idx_product_discounts_active ON public.product_discounts(is_active) WHERE is_active = true;

-- 6. Re-add trigger
CREATE TRIGGER update_product_discounts_updated_at
    BEFORE UPDATE ON public.product_discounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
