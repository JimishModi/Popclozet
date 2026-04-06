-- ============================================================
-- Migration: Drop ambiguous place_order overload
-- Date: 2026-04-06
--
-- Why:
-- PostgREST resolves RPC calls by named arguments. A stale overload of
-- public.place_order with optional recipient fields causes calls from the
-- checkout app to become ambiguous, which breaks UPI/COD order placement.
--
-- This migration removes only the unused recipient overload and preserves
-- the canonical secure-pricing signature used by the customer app.
-- ============================================================

DROP FUNCTION IF EXISTS public.place_order(
  TEXT,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  JSONB,
  TEXT,
  NUMERIC,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  NUMERIC
);

GRANT EXECUTE ON FUNCTION public.place_order(
  TEXT,
  UUID,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  TEXT,
  JSONB,
  TEXT,
  NUMERIC,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  NUMERIC
) TO authenticated;

NOTIFY pgrst, 'reload schema';
