-- ============================================================
-- Migration: Order Address Accuracy Add-on
-- Date: 2026-04-06
--
-- Stores the fetched address snapshot plus customer-entered
-- manual delivery hints on the order itself so customer and
-- warehouse apps can render both consistently.
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_address_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS manual_address_details JSONB;

COMMENT ON COLUMN public.orders.delivery_address_snapshot IS
'Snapshot of the fetched delivery address used at checkout time.';

COMMENT ON COLUMN public.orders.manual_address_details IS
'Customer-entered manual delivery details for improved address accuracy.';

GRANT UPDATE (delivery_address_snapshot, manual_address_details)
  ON public.orders TO authenticated;
