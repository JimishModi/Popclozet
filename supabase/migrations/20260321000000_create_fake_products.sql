-- =============================================================================
-- fake_products: Demand simulation table
-- =============================================================================
-- These items are NEVER orderable. They appear as "Currently Rented" in the UI
-- to simulate inventory depth while the catalogue is still sparse.
--
-- Schema mirrors the actual remote products table (TEXT columns, not enums).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.fake_products (
  id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT            NOT NULL,
  description     TEXT,
  rental_price    NUMERIC,
  deposit_amount  NUMERIC,
  mrp             NUMERIC,
  gender          TEXT            NOT NULL,   -- 'men' | 'women' | 'unisex'
  category        TEXT            NOT NULL,   -- e.g. 'casual', 'wedding', 'party'
  occasion        TEXT[],                     -- multi-occasion tags
  brand           TEXT,
  images          TEXT[]          NOT NULL DEFAULT '{}',
  video_url       TEXT,
  color           TEXT,
  fabric_details  JSONB,
  is_active       BOOLEAN         NOT NULL DEFAULT true,

  -- Rotation metadata
  -- Epoch default: ensures a freshly seeded row is always selected first.
  last_shown_at   TIMESTAMPTZ     NOT NULL DEFAULT '1970-01-01 00:00:00+00',
  show_count      INTEGER         NOT NULL DEFAULT 0,

  created_at      TIMESTAMPTZ     DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     DEFAULT NOW()
);

-- Primary rotation query index
CREATE INDEX IF NOT EXISTS idx_fake_products_rotation
  ON public.fake_products (category, last_shown_at ASC)
  WHERE is_active = true;

-- Brand-scoped rotation queries
CREATE INDEX IF NOT EXISTS idx_fake_products_brand_rotation
  ON public.fake_products (category, brand, last_shown_at ASC)
  WHERE is_active = true;

-- Gender + category filtering
CREATE INDEX IF NOT EXISTS idx_fake_products_gender
  ON public.fake_products (gender, category)
  WHERE is_active = true;

-- =============================================================================
-- Row Level Security
-- =============================================================================

ALTER TABLE public.fake_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fake_products_public_read"
  ON public.fake_products
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "fake_products_service_write"
  ON public.fake_products
  FOR ALL
  USING (auth.role() = 'service_role');

-- =============================================================================
-- RPC: get_and_rotate_fake_products
-- =============================================================================
-- Atomically selects LRU fake products and stamps last_shown_at + show_count.
-- FOR UPDATE SKIP LOCKED prevents concurrent requests double-selecting rows.
-- SECURITY DEFINER allows the UPDATE to bypass the write-only-service_role RLS.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_and_rotate_fake_products(
  p_category  TEXT,
  p_brand     TEXT    DEFAULT NULL,
  p_limit     INTEGER DEFAULT 2
)
RETURNS SETOF public.fake_products
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  selected_ids UUID[];
BEGIN
  SELECT ARRAY_AGG(id) INTO selected_ids
  FROM (
    SELECT id
    FROM   public.fake_products
    WHERE  category  = p_category
      AND  is_active = true
      AND  (p_brand IS NULL OR brand = p_brand)
    ORDER BY last_shown_at ASC
    LIMIT  p_limit
    FOR UPDATE SKIP LOCKED
  ) sub;

  IF selected_ids IS NULL OR ARRAY_LENGTH(selected_ids, 1) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  UPDATE public.fake_products
  SET
    last_shown_at = NOW(),
    show_count    = show_count + 1,
    updated_at    = NOW()
  WHERE id = ANY(selected_ids)
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_and_rotate_fake_products(TEXT, TEXT, INTEGER)
  TO anon, authenticated;
