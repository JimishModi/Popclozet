-- Stop inventory counter updates from auto-creating synthetic physical units.
-- Reservations should move available_stock -> rented_stock without inventing
-- extra rows in all_products.

CREATE OR REPLACE FUNCTION public.reconcile_inventory_physical_units(
  p_inventory_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_processed INT := 0;
BEGIN
  FOR v_inv IN
    SELECT id
    FROM public.inventory
    WHERE p_inventory_id IS NULL OR id = p_inventory_id
    ORDER BY id
    FOR UPDATE
  LOOP
    PERFORM public.recalculate_inventory_stock_from_units(v_inv.id);
    v_processed := v_processed + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', TRUE,
    'inventory_id', p_inventory_id,
    'processed_inventory_rows', v_processed,
    'inserted_units', 0
  );
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_inventory_units_after_stock_change ON public.inventory;

DO $$
DECLARE
  v_inv RECORD;
BEGIN
  IF to_regclass('public.all_products') IS NOT NULL THEN
    DELETE FROM public.all_products ap
    WHERE ap.individual_id ~ '^PC-[A-F0-9]{8}-[A-Z0-9]{1,8}-[A-Z0-9]{4,8}$'
      AND COALESCE(ap.times_rented, 0) = 0
      AND ap.last_rented IS NULL
      AND ap.last_washed IS NULL
      AND ap.created_at >= TIMESTAMPTZ '2026-04-08 00:00:00+00'
      AND NOT EXISTS (
        SELECT 1
        FROM public.order_items oi
        WHERE oi.individual_id = ap.individual_id
      );
  END IF;

  FOR v_inv IN
    SELECT id
    FROM public.inventory
    ORDER BY id
  LOOP
    PERFORM public.recalculate_inventory_stock_from_units(v_inv.id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
