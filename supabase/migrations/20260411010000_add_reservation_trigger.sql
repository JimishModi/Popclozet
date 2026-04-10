CREATE OR REPLACE FUNCTION trigger_sync_inventory_on_reservation()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_inventory_stock_from_units(OLD.variant_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.variant_id IS DISTINCT FROM NEW.variant_id THEN
      PERFORM public.recalculate_inventory_stock_from_units(OLD.variant_id);
    END IF;
    -- Recalculate new variant (also catches generic updates where released_at changes)
    PERFORM public.recalculate_inventory_stock_from_units(NEW.variant_id);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    PERFORM public.recalculate_inventory_stock_from_units(NEW.variant_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_inventory_on_reservation ON public.order_stock_reservations;

CREATE TRIGGER trg_sync_inventory_on_reservation
AFTER INSERT OR UPDATE OR DELETE ON public.order_stock_reservations
FOR EACH ROW
EXECUTE FUNCTION trigger_sync_inventory_on_reservation();
