-- Prevent hard deletes on critical tables.
-- Inventory and all_products should never be deleted directly —
-- only soft-deleted via status changes.
-- NOTE: orders and order_items are left deletable for pre-launch test cleanup.

-- ============================================================
-- 1. Inventory — block DELETE, archive product instead
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_inventory_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION
    'Hard deletes on inventory are not allowed. Set stock counts to 0 or archive the product instead. Inventory: %',
    OLD.id
    USING ERRCODE = 'P0001';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_inventory_hard_delete ON public.inventory;
CREATE TRIGGER trg_prevent_inventory_hard_delete
  BEFORE DELETE ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_inventory_hard_delete();

-- ============================================================
-- 4. All Products (physical units) — block DELETE unless status
--    is already 'archived' or 'lost'
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_physical_unit_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(OLD.status, '') NOT IN ('archived', 'lost', 'damaged') THEN
    RAISE EXCEPTION
      'Cannot delete physical unit %. Set status to ''archived'' first.',
      OLD.individual_id
      USING ERRCODE = 'P0001';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_physical_unit_hard_delete ON public.all_products;
CREATE TRIGGER trg_prevent_physical_unit_hard_delete
  BEFORE DELETE ON public.all_products
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_physical_unit_hard_delete();

NOTIFY pgrst, 'reload schema';
