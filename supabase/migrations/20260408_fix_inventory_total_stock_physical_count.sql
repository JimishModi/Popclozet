-- Fix inventory semantics:
-- - total_stock must mean physical units owned for that product+size.
-- - available_stock must mean units currently bookable.
--
-- A previous migration made total_stock a generated column
-- (available_stock + went_for_wash). That makes rented/reserved units disappear
-- from total_stock, so the customer product page sees total_stock = 0 and shows
-- "Sold Out" instead of "Currently Rented Out".

DO $$
DECLARE
  v_is_generated TEXT;
BEGIN
  IF to_regclass('public.inventory') IS NULL THEN
    RAISE NOTICE 'Skipping total_stock fix: public.inventory is missing.';
    RETURN;
  END IF;

  SELECT is_generated
  INTO v_is_generated
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'inventory'
    AND column_name = 'total_stock';

  IF v_is_generated = 'ALWAYS' THEN
    -- Keep dependent views intact by converting the stored generated column into
    -- a normal column instead of dropping/recreating it.
    ALTER TABLE public.inventory ALTER COLUMN total_stock DROP EXPRESSION IF EXISTS;
  ELSIF v_is_generated IS NULL THEN
    ALTER TABLE public.inventory ADD COLUMN total_stock INTEGER NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Rebuild total_stock from the physical unit ledger when available. Rented and
-- washing pieces still count as physical stock; sold/lost/damaged/archived and
-- instantly_bought pieces do not.
DO $$
BEGIN
  IF to_regclass('public.all_products') IS NOT NULL THEN
    UPDATE public.inventory i
    SET total_stock = GREATEST(
      i.available_stock + i.went_for_wash,
      COALESCE(unit_counts.physical_count, 0)
    )
    FROM (
      SELECT
        inventory_id,
        COUNT(*) FILTER (
          WHERE COALESCE(status, 'available') NOT IN ('sold', 'lost', 'damaged', 'archived', 'instantly_bought')
        )::INT AS physical_count
      FROM public.all_products
      GROUP BY inventory_id
    ) AS unit_counts
    WHERE unit_counts.inventory_id = i.id;

    UPDATE public.inventory i
    SET total_stock = GREATEST(total_stock, available_stock + went_for_wash)
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.all_products ap
      WHERE ap.inventory_id = i.id
    );
  ELSE
    UPDATE public.inventory
    SET total_stock = GREATEST(total_stock, available_stock + went_for_wash);
  END IF;
END $$;

UPDATE public.inventory
SET available_stock = GREATEST(0, available_stock),
    went_for_wash = GREATEST(0, went_for_wash);

UPDATE public.inventory
SET total_stock = GREATEST(total_stock, available_stock + went_for_wash);

ALTER TABLE public.inventory
  ALTER COLUMN total_stock SET DEFAULT 0,
  ALTER COLUMN total_stock SET NOT NULL;

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_stock_non_negative;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_stock_non_negative
  CHECK (
    available_stock >= 0
    AND went_for_wash >= 0
    AND total_stock >= 0
    AND available_stock + went_for_wash <= total_stock
  );

CREATE OR REPLACE FUNCTION public.sync_inventory_on_product_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_old_is_physical BOOLEAN := FALSE;
  v_new_is_physical BOOLEAN := FALSE;
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.status = 'available' THEN
      NEW.available := true;
    ELSE
      NEW.available := false;
    END IF;
  END IF;

  IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
    v_old_is_physical := COALESCE(OLD.status, 'available') NOT IN ('sold', 'lost', 'damaged', 'archived', 'instantly_bought');

    IF OLD.status = 'available' OR OLD.status = 'ready' THEN
      UPDATE public.inventory
      SET available_stock = GREATEST(0, available_stock - 1)
      WHERE id = OLD.inventory_id;
    ELSIF OLD.status = 'washing' THEN
      UPDATE public.inventory
      SET went_for_wash = GREATEST(0, went_for_wash - 1)
      WHERE id = OLD.inventory_id;
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    v_new_is_physical := COALESCE(NEW.status, 'available') NOT IN ('sold', 'lost', 'damaged', 'archived', 'instantly_bought');
  END IF;

  -- Maintain the physical cap before incrementing available/wash counts, so
  -- the inventory_stock_non_negative constraint remains valid mid-trigger.
  IF TG_OP = 'INSERT' AND v_new_is_physical THEN
    UPDATE public.inventory
    SET total_stock = total_stock + 1
    WHERE id = NEW.inventory_id;
  ELSIF TG_OP = 'DELETE' AND v_old_is_physical THEN
    UPDATE public.inventory
    SET total_stock = GREATEST(0, total_stock - 1)
    WHERE id = OLD.inventory_id;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.inventory_id IS DISTINCT FROM NEW.inventory_id THEN
      IF v_old_is_physical THEN
        UPDATE public.inventory
        SET total_stock = GREATEST(0, total_stock - 1)
        WHERE id = OLD.inventory_id;
      END IF;

      IF v_new_is_physical THEN
        UPDATE public.inventory
        SET total_stock = total_stock + 1
        WHERE id = NEW.inventory_id;
      END IF;
    ELSE
      IF v_old_is_physical AND NOT v_new_is_physical THEN
        UPDATE public.inventory
        SET total_stock = GREATEST(0, total_stock - 1)
        WHERE id = NEW.inventory_id;
      ELSIF NOT v_old_is_physical AND v_new_is_physical THEN
        UPDATE public.inventory
        SET total_stock = total_stock + 1
        WHERE id = NEW.inventory_id;
      END IF;
    END IF;
  END IF;

  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF NEW.status = 'available' OR NEW.status = 'ready' THEN
      UPDATE public.inventory
      SET available_stock = available_stock + 1
      WHERE id = NEW.inventory_id;
    ELSIF NEW.status = 'washing' THEN
      UPDATE public.inventory
      SET went_for_wash = went_for_wash + 1
      WHERE id = NEW.inventory_id;
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  IF to_regclass('public.all_products') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_sync_inventory_on_product_status_change ON public.all_products;
    CREATE TRIGGER trg_sync_inventory_on_product_status_change
      BEFORE INSERT OR UPDATE OF status, inventory_id OR DELETE ON public.all_products
      FOR EACH ROW
      EXECUTE FUNCTION public.sync_inventory_on_product_status_change();
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.increment_stock(
  p_variant_id UUID,
  p_quantity   INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INT;
  v_total   INT;
  v_new_stock INT;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quantity must be positive');
  END IF;

  SELECT available_stock, total_stock INTO v_current, v_total
  FROM public.inventory
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Variant not found');
  END IF;

  v_new_stock := LEAST(v_total, v_current + p_quantity);

  UPDATE public.inventory
  SET available_stock = v_new_stock
  WHERE id = p_variant_id;

  RETURN jsonb_build_object('success', true, 'new_stock', v_new_stock);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_checkout_stock(
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item     RECORD;
  v_current  INT;
  v_total    INT;
  v_released JSONB := '[]'::JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'No items provided');
  END IF;

  FOR v_item IN
    SELECT
      (elem->>'variant_id')::UUID AS variant_id,
      (elem->>'quantity')::INT    AS quantity
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'variant_id')::UUID ASC
  LOOP
    IF v_item.quantity IS NULL OR v_item.quantity <= 0 THEN
      CONTINUE;
    END IF;

    SELECT available_stock, total_stock INTO v_current, v_total
    FROM public.inventory
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    UPDATE public.inventory
    SET available_stock = LEAST(v_total, v_current + v_item.quantity)
    WHERE id = v_item.variant_id;

    v_released := v_released || jsonb_build_array(
      jsonb_build_object('variant_id', v_item.variant_id, 'quantity', v_item.quantity)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'released_items', v_released);
END;
$$;

CREATE OR REPLACE FUNCTION public.release_order_stock(
  p_order_id UUID,
  p_reason   TEXT DEFAULT 'manual'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_released    INT := 0;
  v_current     INT;
  v_total       INT;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'order_id required');
  END IF;

  FOR v_reservation IN
    SELECT id, variant_id, quantity
    FROM public.order_stock_reservations
    WHERE order_id = p_order_id
      AND released_at IS NULL
    ORDER BY variant_id ASC
    FOR UPDATE
  LOOP
    UPDATE public.order_stock_reservations
    SET released_at = NOW(),
        release_reason = p_reason
    WHERE id = v_reservation.id;

    SELECT available_stock, total_stock INTO v_current, v_total
    FROM public.inventory
    WHERE id = v_reservation.variant_id
    FOR UPDATE;

    IF FOUND THEN
      UPDATE public.inventory
      SET available_stock = LEAST(v_total, v_current + v_reservation.quantity)
      WHERE id = v_reservation.variant_id;
    END IF;

    v_released := v_released + 1;
  END LOOP;

  IF v_released > 0 AND to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
    INSERT INTO public.warehouse_activity_log (
      action, entity_type, entity_id,
      actor_id, details
    ) VALUES (
      'stock_released',
      'order',
      p_order_id,
      '00000000-0000-0000-0000-000000000000'::UUID,
      jsonb_build_object('reason', p_reason, 'reservations_released', v_released)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'released_count', v_released,
    'reason', p_reason
  );
END;
$$;

-- Re-run the cancelled unpaid backfill now that total_stock is a physical cap.
DO $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_has_reservations BOOLEAN := FALSE;
  v_fallback_count INT := 0;
BEGIN
  IF to_regclass('public.orders') IS NULL
     OR to_regclass('public.order_items') IS NULL
     OR to_regclass('public.inventory') IS NULL THEN
    RETURN;
  END IF;

  FOR v_order IN
    SELECT o.id
    FROM public.orders o
    WHERE o.status = 'cancelled'
      AND NOT EXISTS (
        SELECT 1
        FROM public.payments p
        WHERE p.order_id = o.id
          AND (
            p.razorpay_payment_id IS NOT NULL
            OR COALESCE(p.status, '') IN ('completed', 'success', 'succeeded', 'paid', 'captured')
          )
      )
    FOR UPDATE SKIP LOCKED
  LOOP
    v_has_reservations := FALSE;

    IF to_regclass('public.order_stock_reservations') IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.order_stock_reservations
        WHERE order_id = v_order.id
      )
      INTO v_has_reservations;

      -- If an older generated total_stock collapsed to 0, lift the physical cap
      -- before releasing so LEAST(total_stock, available + quantity) can restore.
      UPDATE public.inventory i
      SET total_stock = GREATEST(i.total_stock, i.available_stock + i.went_for_wash + pending.quantity)
      FROM (
        SELECT variant_id, SUM(quantity)::INT AS quantity
        FROM public.order_stock_reservations
        WHERE order_id = v_order.id
          AND released_at IS NULL
        GROUP BY variant_id
      ) AS pending
      WHERE i.id = pending.variant_id;

      PERFORM public.release_order_stock(v_order.id, 'cancelled_unpaid_total_stock_fix');
    END IF;

    IF NOT v_has_reservations THEN
      FOR v_item IN
        SELECT oi.product_id, COALESCE(NULLIF(oi.size, ''), 'One Size') AS size
        FROM public.order_items oi
        WHERE oi.order_id = v_order.id
      LOOP
        -- Conservative rescue for legacy rows without reservation bookkeeping and
        -- without a usable physical ledger: only lift a completely collapsed row.
        UPDATE public.inventory i
        SET total_stock = 1
        WHERE i.product_id = v_item.product_id
          AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item.size
          AND i.total_stock = 0
          AND i.available_stock = 0
          AND i.went_for_wash = 0;

        UPDATE public.inventory i
        SET available_stock = LEAST(i.total_stock, i.available_stock + 1)
        WHERE i.product_id = v_item.product_id
          AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item.size
          AND i.available_stock + i.went_for_wash < i.total_stock;

        IF FOUND THEN
          v_fallback_count := v_fallback_count + 1;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RAISE NOTICE 'total_stock physical-count fix completed. Fallback rows restored: %', v_fallback_count;
END $$;

NOTIFY pgrst, 'reload schema';
