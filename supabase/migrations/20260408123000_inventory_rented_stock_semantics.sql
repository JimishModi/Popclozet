-- Inventory bucket semantics:
--   available_stock + rented_stock + went_for_wash = total_stock
--
-- total_stock changes when physical units are added/removed.
-- Renting/reserving moves stock from available_stock to rented_stock.
-- Wash moves stock from rented/returned into went_for_wash, then back to
-- available_stock when wash completes.

DROP TRIGGER IF EXISTS trg_reconcile_inventory_units_after_stock_change ON public.inventory;

DO $$
DECLARE
  v_trigger RECORD;
BEGIN
  IF to_regclass('public.all_products') IS NOT NULL
     AND to_regprocedure('public.handle_all_products_sync()') IS NOT NULL THEN
    FOR v_trigger IN
      SELECT tgname
      FROM pg_trigger
      WHERE tgrelid = 'public.all_products'::REGCLASS
        AND tgfoid = to_regprocedure('public.handle_all_products_sync()')
        AND NOT tgisinternal
    LOOP
      EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.all_products', v_trigger.tgname);
    END LOOP;
  END IF;
END $$;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS rented_stock INTEGER NOT NULL DEFAULT 0;

UPDATE public.inventory
SET available_stock = GREATEST(0, COALESCE(available_stock, 0)),
    rented_stock = GREATEST(
      0,
      COALESCE(rented_stock, 0),
      COALESCE(total_stock, 0) - COALESCE(available_stock, 0) - COALESCE(went_for_wash, 0)
    ),
    went_for_wash = GREATEST(0, COALESCE(went_for_wash, 0)),
    total_stock = GREATEST(
      COALESCE(total_stock, 0),
      COALESCE(available_stock, 0) + COALESCE(rented_stock, 0) + COALESCE(went_for_wash, 0)
    );

ALTER TABLE public.inventory
  DROP CONSTRAINT IF EXISTS inventory_stock_non_negative;

ALTER TABLE public.inventory
  ADD CONSTRAINT inventory_stock_non_negative
  CHECK (
    available_stock >= 0
    AND rented_stock >= 0
    AND went_for_wash >= 0
    AND total_stock >= 0
    AND available_stock + rented_stock + went_for_wash = total_stock
  );

CREATE OR REPLACE FUNCTION public.prepare_inventory_physical_unit_target()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('popclozet.reconciling_inventory_units', TRUE) = 'on' THEN
    RETURN NEW;
  END IF;

  NEW.available_stock := GREATEST(0, COALESCE(NEW.available_stock, 0));
  NEW.rented_stock := GREATEST(0, COALESCE(NEW.rented_stock, 0));
  NEW.went_for_wash := GREATEST(0, COALESCE(NEW.went_for_wash, 0));

  IF COALESCE(NEW.total_stock, 0) > NEW.available_stock + NEW.rented_stock + NEW.went_for_wash THEN
    NEW.rented_stock := NEW.rented_stock + (
      COALESCE(NEW.total_stock, 0) - NEW.available_stock - NEW.rented_stock - NEW.went_for_wash
    );
  ELSE
    NEW.total_stock := NEW.available_stock + NEW.rented_stock + NEW.went_for_wash;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prepare_inventory_physical_unit_target ON public.inventory;
CREATE TRIGGER trg_prepare_inventory_physical_unit_target
  BEFORE INSERT OR UPDATE OF total_stock, available_stock, rented_stock, went_for_wash
  ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.prepare_inventory_physical_unit_target();

CREATE OR REPLACE FUNCTION public.recalculate_inventory_stock_from_units(
  p_inventory_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_available_units INT := 0;
  v_rented_units INT := 0;
  v_wash_units INT := 0;
  v_total_units INT := 0;
  v_active_reserved INT := 0;
  v_reserved_available_units INT := 0;
BEGIN
  IF p_inventory_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM set_config('popclozet.reconciling_inventory_units', 'on', TRUE);

  SELECT
    COUNT(*) FILTER (
      WHERE COALESCE(status, 'available') NOT IN (
        'sold', 'lost', 'damaged', 'archived', 'instantly_bought'
      )
    )::INT,
    COUNT(*) FILTER (
      WHERE COALESCE(status, 'available') IN ('available', 'ready')
    )::INT,
    COUNT(*) FILTER (
      WHERE COALESCE(status, 'available') = 'rented'
    )::INT,
    COUNT(*) FILTER (
      WHERE COALESCE(status, 'available') IN ('returned', 'washing')
    )::INT
  INTO v_total_units, v_available_units, v_rented_units, v_wash_units
  FROM public.all_products
  WHERE inventory_id = p_inventory_id;

  IF to_regclass('public.order_stock_reservations') IS NOT NULL THEN
    SELECT COALESCE(SUM(quantity), 0)::INT
    INTO v_active_reserved
    FROM public.order_stock_reservations
    WHERE variant_id = p_inventory_id
      AND released_at IS NULL;
  END IF;

  -- Reservations reduce what customers can book, but the physical unit remains
  -- status='available' until warehouse packing assigns it.
  v_reserved_available_units := LEAST(v_active_reserved, v_available_units);

  UPDATE public.inventory
  SET total_stock = v_total_units,
      available_stock = GREATEST(0, v_available_units - v_reserved_available_units),
      rented_stock = v_rented_units + v_reserved_available_units,
      went_for_wash = v_wash_units
  WHERE id = p_inventory_id;

  PERFORM set_config('popclozet.reconciling_inventory_units', 'off', TRUE);
END;
$$;

CREATE OR REPLACE FUNCTION public.reconcile_inventory_physical_units(
  p_inventory_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv RECORD;
  v_status TEXT;
  v_idx INT;
  v_active_reserved INT;
  v_physical_count INT;
  v_available_unit_count INT;
  v_rented_unit_count INT;
  v_washing_unit_count INT;
  v_target_total INT;
  v_target_available_units INT;
  v_target_rented_units INT;
  v_target_washing_units INT;
  v_missing_total INT;
  v_missing_available INT;
  v_missing_rented INT;
  v_missing_washing INT;
  v_inserted INT;
  v_total_inserted INT := 0;
  v_product_mrp_expr TEXT := 'NULL::NUMERIC';
  v_product_cost_expr TEXT := 'NULL::NUMERIC';
BEGIN
  PERFORM set_config('popclozet.reconciling_inventory_units', 'on', TRUE);

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'mrp'
  ) THEN
    v_product_mrp_expr := 'p.mrp';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'mrp_price'
  ) THEN
    v_product_mrp_expr := 'p.mrp_price';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'products'
      AND column_name = 'actual_cost'
  ) THEN
    v_product_cost_expr := 'p.actual_cost';
  END IF;

  FOR v_inv IN EXECUTE format(
    'SELECT
      i.id,
      i.product_id,
      i.size,
      GREATEST(0, COALESCE(i.available_stock, 0)) AS available_stock,
      GREATEST(0, COALESCE(i.rented_stock, 0)) AS rented_stock,
      GREATEST(0, COALESCE(i.went_for_wash, 0)) AS went_for_wash,
      GREATEST(0, COALESCE(i.total_stock, 0)) AS total_stock,
      %s AS mrp,
      %s AS actual_cost
    FROM public.inventory i
    LEFT JOIN public.products p ON p.id = i.product_id
    WHERE $1 IS NULL OR i.id = $1
    ORDER BY i.id
    FOR UPDATE OF i',
    v_product_mrp_expr,
    v_product_cost_expr
  ) USING p_inventory_id
  LOOP
    SELECT
      COUNT(*) FILTER (
        WHERE COALESCE(status, 'available') NOT IN (
          'sold', 'lost', 'damaged', 'archived', 'instantly_bought'
        )
      )::INT,
      COUNT(*) FILTER (
        WHERE COALESCE(status, 'available') IN ('available', 'ready')
      )::INT,
      COUNT(*) FILTER (
        WHERE COALESCE(status, 'available') = 'rented'
      )::INT,
      COUNT(*) FILTER (
        WHERE COALESCE(status, 'available') IN ('returned', 'washing')
      )::INT
    INTO v_physical_count, v_available_unit_count, v_rented_unit_count, v_washing_unit_count
    FROM public.all_products
    WHERE inventory_id = v_inv.id;

    IF to_regclass('public.order_stock_reservations') IS NOT NULL THEN
      SELECT COALESCE(SUM(quantity), 0)::INT
      INTO v_active_reserved
      FROM public.order_stock_reservations
      WHERE variant_id = v_inv.id
        AND released_at IS NULL;
    ELSE
      v_active_reserved := 0;
    END IF;

    v_target_total := GREATEST(
      v_inv.total_stock,
      v_inv.available_stock + v_inv.rented_stock + v_inv.went_for_wash,
      v_inv.available_stock + v_inv.went_for_wash + v_active_reserved,
      v_physical_count
    );
    v_target_available_units := LEAST(
      v_target_total,
      v_inv.available_stock + LEAST(v_active_reserved, GREATEST(0, v_target_total - v_inv.went_for_wash))
    );
    v_target_washing_units := LEAST(
      v_inv.went_for_wash,
      GREATEST(0, v_target_total - v_target_available_units)
    );
    v_target_rented_units := LEAST(
      GREATEST(0, v_inv.rented_stock - v_active_reserved),
      GREATEST(0, v_target_total - v_target_available_units - v_target_washing_units)
    );

    v_missing_total := GREATEST(0, v_target_total - v_physical_count);
    v_missing_available := GREATEST(0, v_target_available_units - v_available_unit_count);
    v_missing_washing := GREATEST(0, v_target_washing_units - v_washing_unit_count);
    v_missing_rented := GREATEST(0, v_target_rented_units - v_rented_unit_count);

    FOR v_idx IN 1..v_missing_total LOOP
      IF v_missing_available > 0 THEN
        v_status := 'available';
        v_missing_available := v_missing_available - 1;
      ELSIF v_missing_washing > 0 THEN
        v_status := 'washing';
        v_missing_washing := v_missing_washing - 1;
      ELSIF v_missing_rented > 0 THEN
        v_status := 'rented';
        v_missing_rented := v_missing_rented - 1;
      ELSE
        v_status := 'rented';
      END IF;

      INSERT INTO public.all_products (
        individual_id,
        inventory_id,
        status,
        available,
        mrp_price,
        actual_cost
      ) VALUES (
        format(
          'PC-%s-%s-%s',
          upper(left(replace(v_inv.product_id::TEXT, '-', ''), 8)),
          upper(left(regexp_replace(COALESCE(NULLIF(v_inv.size, ''), 'OS'), '[^A-Za-z0-9]+', '', 'g'), 8)),
          upper(left(replace(gen_random_uuid()::TEXT, '-', ''), 8))
        ),
        v_inv.id,
        v_status,
        v_status = 'available',
        v_inv.mrp,
        v_inv.actual_cost
      )
      ON CONFLICT (individual_id) DO NOTHING;

      GET DIAGNOSTICS v_inserted = ROW_COUNT;
      v_total_inserted := v_total_inserted + v_inserted;
    END LOOP;

    PERFORM public.recalculate_inventory_stock_from_units(v_inv.id);
  END LOOP;

  PERFORM set_config('popclozet.reconciling_inventory_units', 'off', TRUE);

  RETURN jsonb_build_object(
    'success', TRUE,
    'inventory_id', p_inventory_id,
    'inserted_units', v_total_inserted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_all_products_available_flag()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.available := COALESCE(NEW.status, 'available') IN ('available', 'ready');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_inventory_on_product_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('popclozet.reconciling_inventory_units', TRUE) = 'on' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_inventory_stock_from_units(OLD.inventory_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.inventory_id IS DISTINCT FROM NEW.inventory_id THEN
    PERFORM public.recalculate_inventory_stock_from_units(OLD.inventory_id);
  END IF;

  PERFORM public.recalculate_inventory_stock_from_units(NEW.inventory_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_all_products_available_flag ON public.all_products;
CREATE TRIGGER trg_sync_all_products_available_flag
  BEFORE INSERT OR UPDATE OF status
  ON public.all_products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_all_products_available_flag();

DROP TRIGGER IF EXISTS trg_sync_inventory_on_product_status_change ON public.all_products;
CREATE TRIGGER trg_sync_inventory_on_product_status_change
  AFTER INSERT OR UPDATE OF status, inventory_id OR DELETE ON public.all_products
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_inventory_on_product_status_change();

CREATE OR REPLACE FUNCTION public.reconcile_inventory_units_after_stock_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('popclozet.reconciling_inventory_units', TRUE) = 'on' THEN
    RETURN NEW;
  END IF;

  PERFORM public.reconcile_inventory_physical_units(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reconcile_inventory_units_after_stock_change ON public.inventory;
CREATE TRIGGER trg_reconcile_inventory_units_after_stock_change
  AFTER INSERT OR UPDATE OF total_stock, available_stock, rented_stock, went_for_wash
  ON public.inventory
  FOR EACH ROW
  EXECUTE FUNCTION public.reconcile_inventory_units_after_stock_change();

CREATE OR REPLACE FUNCTION public.decrement_stock(
  p_variant_id UUID,
  p_quantity   INT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INT;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quantity must be positive');
  END IF;

  SELECT available_stock INTO v_current
  FROM public.inventory
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Variant not found');
  END IF;

  IF v_current < p_quantity THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Insufficient stock',
      'available', v_current,
      'requested', p_quantity
    );
  END IF;

  UPDATE public.inventory
  SET available_stock = available_stock - p_quantity,
      rented_stock = rented_stock + p_quantity
  WHERE id = p_variant_id;

  RETURN jsonb_build_object('success', true, 'new_stock', v_current - p_quantity);
END;
$$;

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
  v_rented INT;
  v_moved INT;
BEGIN
  IF p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Quantity must be positive');
  END IF;

  SELECT available_stock, rented_stock INTO v_current, v_rented
  FROM public.inventory
  WHERE id = p_variant_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Variant not found');
  END IF;

  v_moved := LEAST(v_rented, p_quantity);

  UPDATE public.inventory
  SET available_stock = available_stock + v_moved,
      rented_stock = rented_stock - v_moved
  WHERE id = p_variant_id;

  RETURN jsonb_build_object('success', true, 'new_stock', v_current + v_moved);
END;
$$;

CREATE OR REPLACE FUNCTION public.reserve_checkout_stock(
  p_items JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item      RECORD;
  v_current   INT;
  v_reserved  JSONB := '[]'::JSONB;
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
      RAISE EXCEPTION 'Invalid quantity for variant %', v_item.variant_id
        USING ERRCODE = 'P0001';
    END IF;

    SELECT available_stock INTO v_current
    FROM public.inventory
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Variant % not found', v_item.variant_id
        USING ERRCODE = 'P0002';
    END IF;

    IF v_current < v_item.quantity THEN
      RAISE EXCEPTION 'Insufficient stock for variant %. Available: %, Requested: %',
        v_item.variant_id, v_current, v_item.quantity
        USING ERRCODE = 'P0003';
    END IF;

    UPDATE public.inventory
    SET available_stock = available_stock - v_item.quantity,
        rented_stock = rented_stock + v_item.quantity
    WHERE id = v_item.variant_id;

    v_reserved := v_reserved || jsonb_build_array(
      jsonb_build_object('variant_id', v_item.variant_id, 'quantity', v_item.quantity)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'reserved_items', v_reserved);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', SQLSTATE,
      'message', SQLERRM
    );
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
  v_rented   INT;
  v_released INT;
  v_released_items JSONB := '[]'::JSONB;
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

    SELECT rented_stock INTO v_rented
    FROM public.inventory
    WHERE id = v_item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    v_released := LEAST(v_rented, v_item.quantity);

    UPDATE public.inventory
    SET available_stock = available_stock + v_released,
        rented_stock = rented_stock - v_released
    WHERE id = v_item.variant_id;

    v_released_items := v_released_items || jsonb_build_array(
      jsonb_build_object('variant_id', v_item.variant_id, 'quantity', v_released)
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'released_items', v_released_items);
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
  v_rented      INT;
  v_restore_qty INT;
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

    SELECT rented_stock INTO v_rented
    FROM public.inventory
    WHERE id = v_reservation.variant_id
    FOR UPDATE;

    IF FOUND THEN
      v_restore_qty := LEAST(v_rented, v_reservation.quantity);

      UPDATE public.inventory
      SET available_stock = available_stock + v_restore_qty,
          rented_stock = rented_stock - v_restore_qty
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

GRANT EXECUTE ON FUNCTION public.decrement_stock(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_stock(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_checkout_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_checkout_stock(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.release_order_stock(UUID, TEXT) TO service_role;

SELECT public.reconcile_inventory_physical_units(NULL);

CREATE OR REPLACE VIEW public.product_stock_summary AS
SELECT
    p.id,
    p.name,
    p.brand,
    p.category,
    p.images,
    p.rental_price,
    p.is_available,
    COALESCE(SUM(i.available_stock), 0) as total_available,
    COALESCE(SUM(i.went_for_wash), 0) as total_wash,
    COALESCE(SUM(i.total_stock), 0) as total_stock
FROM
    public.products p
LEFT JOIN
    public.inventory i ON p.id = i.product_id
GROUP BY
    p.id;

GRANT SELECT ON public.product_stock_summary TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
