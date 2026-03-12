-- Migration: Create Product Discounts Table
-- Description: Handles discounts for rental products linked by product_id

-- Helper function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TABLE IF NOT EXISTS public.product_discounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed_amount')),
    discount_value DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster lookups when filtering active discounts
CREATE INDEX IF NOT EXISTS idx_product_discounts_product_id ON public.product_discounts(product_id);
CREATE INDEX IF NOT EXISTS idx_product_discounts_active ON public.product_discounts(is_active) WHERE is_active = true;

-- Add updated_at trigger if doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_product_discounts_updated_at') THEN
        CREATE TRIGGER update_product_discounts_updated_at
            BEFORE UPDATE ON public.product_discounts
            FOR EACH ROW
            EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;
