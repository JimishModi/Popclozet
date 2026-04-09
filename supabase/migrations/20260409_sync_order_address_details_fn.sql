-- Create the sync_order_address_details RPC function.
-- The column exists (20260406) and the customer-app calls this RPC at checkout,
-- but the function was never defined — so manual_address_details was silently
-- never persisted.

CREATE OR REPLACE FUNCTION public.sync_order_address_details(
  p_order_id                  UUID,
  p_delivery_address_snapshot JSONB,
  p_manual_address_details    JSONB DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET delivery_address_snapshot = p_delivery_address_snapshot,
      manual_address_details    = p_manual_address_details,
      updated_at                = NOW()
  WHERE id = p_order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_order_address_details(UUID, JSONB, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_order_address_details(UUID, JSONB, JSONB) TO service_role;

NOTIFY pgrst, 'reload schema';
