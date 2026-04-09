-- Allow direct deletes on inventory and all_products again.
-- Warehouse delete actions should be able to physically remove rows, while the
-- existing stock-sync triggers keep inventory counts aligned on unit deletes.

DROP TRIGGER IF EXISTS trg_prevent_inventory_hard_delete ON public.inventory;
DROP TRIGGER IF EXISTS trg_prevent_physical_unit_hard_delete ON public.all_products;

DROP FUNCTION IF EXISTS public.prevent_inventory_hard_delete();
DROP FUNCTION IF EXISTS public.prevent_physical_unit_hard_delete();

NOTIFY pgrst, 'reload schema';
