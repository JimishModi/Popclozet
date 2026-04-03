-- Migration: Create coupons table for promo code validation
-- Coupons are applied on the final rental price (after MRP discount)

CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_value NUMERIC(10,2) NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  min_order_value NUMERIC(10,2) DEFAULT 0,
  max_discount NUMERIC(10,2) DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  usage_limit INT DEFAULT NULL,
  used_count INT NOT NULL DEFAULT 0,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS: anyone can read active coupons (for validation), only service role can modify
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active coupons"
  ON public.coupons FOR SELECT
  USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

-- Seed some initial coupons
INSERT INTO public.coupons (code, discount_value, discount_type, min_order_value) VALUES
  ('POP20', 20, 'percentage', 0),
  ('FIRST100', 100, 'fixed', 0)
ON CONFLICT (code) DO NOTHING;
