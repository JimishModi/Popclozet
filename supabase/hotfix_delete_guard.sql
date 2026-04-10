-- Hotfix: All inventory + availability fixes
-- Run against linked remote DB via Dashboard SQL Editor

-- 1. Drop the delete guard trigger
DROP TRIGGER IF EXISTS trg_prevent_physical_unit_hard_delete ON public.all_products;
DROP FUNCTION IF EXISTS public.prevent_physical_unit_hard_delete();

-- 1b. Allow customers to see ALL products (sold out shown on UI, not hidden)
DROP POLICY IF EXISTS "Anyone can view available products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view entitled products" ON public.products;
DROP POLICY IF EXISTS "Anyone can view products" ON public.products;
CREATE POLICY "Anyone can view products"
  ON public.products FOR SELECT
  USING (true);

-- 1c. Add 'buyout' to order_type constraint (if not already present)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_order_type_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_order_type_check
  CHECK (order_type IN ('rental', 'home_try_on', 'delivery', 'pickup', 'return', 'buyout'));

-- 2. Fix sync_product_availability: remove the reconciliation skip guard
CREATE OR REPLACE FUNCTION public.sync_product_availability()
RETURNS TRIGGER AS $$
DECLARE
  v_product_id UUID;
  v_any_available BOOLEAN;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  SELECT EXISTS (
    SELECT 1 FROM public.inventory
    WHERE product_id = v_product_id
      AND available_stock > 0
  ) INTO v_any_available;

  UPDATE public.products
  SET is_available = v_any_available
  WHERE id = v_product_id
    AND is_available IS DISTINCT FROM v_any_available;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Backfill products.is_available
UPDATE public.products p
SET is_available = EXISTS (
  SELECT 1 FROM public.inventory i
  WHERE i.product_id = p.id AND i.available_stock > 0
)
WHERE p.is_available IS DISTINCT FROM EXISTS (
  SELECT 1 FROM public.inventory i
  WHERE i.product_id = p.id AND i.available_stock > 0
);

-- 4. Drop old place_order overload
DROP FUNCTION IF EXISTS public.place_order(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB, NUMERIC, NUMERIC, TIMESTAMPTZ, TEXT, TEXT);

-- 5. Updated place_order: assigns physical units + marks status at order time
CREATE OR REPLACE FUNCTION place_order(
  p_idempotency_key    TEXT,
  p_address_id         UUID,
  p_start_date         TIMESTAMPTZ,
  p_end_date           TIMESTAMPTZ,
  p_payment_method     TEXT,
  p_items              JSONB,
  p_coupon_code        TEXT DEFAULT NULL,
  p_route_distance_km  NUMERIC DEFAULT 0,
  p_delivery_eta       TIMESTAMPTZ DEFAULT NULL,
  p_return_pickup_date TEXT DEFAULT NULL,
  p_return_time_slot   TEXT DEFAULT NULL,
  p_delivery_fee       NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         UUID;
  v_order_id        UUID;
  v_existing        RECORD;
  v_item            JSONB;
  v_product         RECORD;
  v_inv             RECORD;
  v_unit_price      NUMERIC;
  v_line_total      NUMERIC;
  v_subtotal        NUMERIC := 0;
  v_delivery_fee    NUMERIC;
  v_coupon_result   JSONB;
  v_coupon_discount NUMERIC := 0;
  v_coupon_code_upper TEXT;
  v_total           NUMERIC;
  v_status          TEXT;
  v_plan_days       INT;
  v_item_count      INT := 0;
  v_item_size       TEXT;
  v_item_qty        INT;
  v_unit_id         TEXT;
  v_unit_idx        INT;
  v_item_plan       TEXT;
  v_is_buy_order    BOOLEAN := FALSE;
BEGIN
  -- AUTH
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to place an order');
  END IF;

  -- IDEMPOTENCY
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));
    SELECT id, status INTO v_existing
    FROM orders WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'order_id', v_existing.id, 'status', v_existing.status,
        'idempotent', true, 'message', 'Order already exists for this request');
    END IF;
  END IF;

  -- VALIDATE items
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_CART',
      'message', 'Cannot place an order with no items');
  END IF;

  -- VALIDATE address ownership
  IF NOT EXISTS (
    SELECT 1 FROM addresses WHERE id = p_address_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ADDRESS',
      'message', 'Delivery address not found or does not belong to you');
  END IF;

  -- COMPUTE DELIVERY FEE (server-side)
  v_delivery_fee := compute_delivery_fee(p_route_distance_km);
  IF v_delivery_fee = -1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'OUT_OF_RANGE',
      'message', 'Sorry, this area is outside our delivery range (max 7km).');
  END IF;

  -- DETECT if every item is a buy
  SELECT bool_and((elem->>'plan') = 'buy')
  INTO v_is_buy_order
  FROM jsonb_array_elements(p_items) AS elem;

  -- STATUS
  IF p_payment_method = 'cod' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
  END IF;

  -- RESERVE STOCK + ASSIGN PHYSICAL UNITS
  FOR v_item IN
    SELECT elem
    FROM jsonb_array_elements(p_items) AS elem
    ORDER BY (elem->>'product_id')::TEXT, COALESCE(elem->>'size', 'One Size')
  LOOP
    v_item_size := COALESCE(v_item->>'size', 'One Size');
    v_item_qty := GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);

    SELECT id, rental_price, rental_price_1d, rental_price_2d, rental_price_3d,
           buy_price, is_available
    INTO v_product
    FROM products WHERE id = (v_item->>'product_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'product_id' USING ERRCODE = 'P0002';
    END IF;

    IF v_product.is_available IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Product % is not available', v_item->>'product_id' USING ERRCODE = 'P0003';
    END IF;

    SELECT i.id, i.available_stock, i.rented_stock, i.total_stock
    INTO v_inv
    FROM inventory i
    WHERE i.product_id = (v_item->>'product_id')::UUID
      AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item_size
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No inventory for product % size %', v_item->>'product_id', v_item_size
        USING ERRCODE = 'P0003';
    END IF;

    IF v_inv.available_stock < v_item_qty THEN
      RAISE EXCEPTION 'Insufficient stock for product % size %. Available: %, Requested: %',
        v_item->>'product_id', v_item_size, v_inv.available_stock, v_item_qty
        USING ERRCODE = 'P0003';
    END IF;

    -- Reserve inventory counters
    PERFORM set_config('popclozet.reconciling_inventory_units', 'on', TRUE);

    UPDATE inventory
    SET available_stock = available_stock - v_item_qty,
        rented_stock = rented_stock + v_item_qty
    WHERE id = v_inv.id;

    PERFORM set_config('popclozet.reconciling_inventory_units', 'off', TRUE);

    -- Assign physical units and mark status
    v_item_plan := COALESCE(v_item->>'plan', '3d');
    FOR v_unit_idx IN 1..v_item_qty LOOP
      v_unit_id := NULL;

      SELECT ap.individual_id INTO v_unit_id
      FROM all_products ap
      WHERE ap.inventory_id = v_inv.id
        AND COALESCE(ap.status, 'available') IN ('available', 'ready')
      ORDER BY ap.last_washed NULLS FIRST, ap.created_at, ap.individual_id
      FOR UPDATE SKIP LOCKED
      LIMIT 1;

      IF v_unit_id IS NOT NULL THEN
        IF v_item_plan = 'buy' THEN
          UPDATE all_products
          SET status = 'instantly_bought', available = FALSE
          WHERE individual_id = v_unit_id;
        ELSE
          UPDATE all_products
          SET status = 'rented',
              available = FALSE,
              last_rented = NOW(),
              times_rented = COALESCE(times_rented, 0) + 1
          WHERE individual_id = v_unit_id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  -- CREATE ORDER
  INSERT INTO orders (
    user_id, delivery_address_id, rental_start_date, rental_end_date,
    total_amount, delivery_eta, status, payment_method,
    delivery_fee, route_distance_km, return_pickup_date, return_time_slot,
    idempotency_key, order_type
  ) VALUES (
    v_user_id, p_address_id, p_start_date, p_end_date,
    0, p_delivery_eta, v_status, p_payment_method,
    v_delivery_fee, p_route_distance_km,
    CASE WHEN v_is_buy_order THEN NULL ELSE NULLIF(p_return_pickup_date, '')::DATE END,
    CASE WHEN v_is_buy_order THEN NULL ELSE p_return_time_slot END,
    p_idempotency_key,
    CASE WHEN v_is_buy_order THEN 'buyout' ELSE 'rental' END
  )
  RETURNING id INTO v_order_id;

  -- INSERT ITEMS + STOCK RESERVATIONS
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_size := COALESCE(v_item->>'size', 'One Size');
    v_item_qty := GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);

    SELECT id, rental_price, rental_price_1d, rental_price_2d, rental_price_3d, buy_price
    INTO v_product
    FROM products WHERE id = (v_item->>'product_id')::UUID;

    v_unit_price := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN COALESCE(v_product.rental_price_1d, v_product.rental_price)
      WHEN '2d' THEN COALESCE(v_product.rental_price_2d, v_product.rental_price)
      WHEN '3d' THEN COALESCE(v_product.rental_price_3d, v_product.rental_price)
      WHEN 'buy' THEN COALESCE(v_product.buy_price, v_product.rental_price * 5)
      ELSE v_product.rental_price
    END;

    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION 'No valid price for product % plan %',
        v_item->>'product_id', COALESCE(v_item->>'plan', '3d') USING ERRCODE = 'P0004';
    END IF;

    v_plan_days := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN 1 WHEN '2d' THEN 2 WHEN '3d' THEN 3 WHEN 'buy' THEN 0 ELSE 3
    END;

    v_line_total := v_unit_price * v_item_qty;

    -- Find the physical unit we already reserved in loop 1 and link it
    v_unit_id := NULL;
    v_item_plan := COALESCE(v_item->>'plan', '3d');
    IF v_item_plan = 'buy' THEN
      SELECT ap.individual_id INTO v_unit_id
      FROM all_products ap
      WHERE ap.inventory_id = (
        SELECT i.id FROM inventory i
        WHERE i.product_id = (v_item->>'product_id')::UUID
          AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item_size
        LIMIT 1
      )
        AND ap.status = 'instantly_bought'
      ORDER BY ap.created_at DESC
      LIMIT 1;
    ELSE
      -- Find the unit we already marked as 'rented' in loop 1
      SELECT ap.individual_id INTO v_unit_id
      FROM all_products ap
      WHERE ap.inventory_id = (
        SELECT i.id FROM inventory i
        WHERE i.product_id = (v_item->>'product_id')::UUID
          AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item_size
        LIMIT 1
      )
        AND ap.status = 'rented'
        AND ap.individual_id NOT IN (
          SELECT oi.individual_id FROM order_items oi
          WHERE oi.individual_id IS NOT NULL
        )
      ORDER BY ap.last_rented DESC NULLS LAST
      LIMIT 1;
    END IF;

    INSERT INTO order_items (order_id, product_id, size, rental_price, rental_duration_days, pricing_plan, individual_id)
    VALUES (v_order_id, v_product.id, v_item_size, v_line_total, v_plan_days, COALESCE(v_item->>'plan', '3d'), v_unit_id);

    SELECT i.id INTO v_inv
    FROM inventory i
    WHERE i.product_id = (v_item->>'product_id')::UUID
      AND COALESCE(NULLIF(i.size, ''), 'One Size') = v_item_size;

    IF FOUND THEN
      INSERT INTO order_stock_reservations (order_id, variant_id, quantity)
      VALUES (v_order_id, v_inv.id, v_item_qty)
      ON CONFLICT DO NOTHING;
    END IF;

    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + 1;
  END LOOP;

  -- VALIDATE & APPLY COUPON
  v_coupon_code_upper := UPPER(TRIM(COALESCE(p_coupon_code, '')));
  IF v_coupon_code_upper != '' THEN
    v_coupon_result := validate_coupon(v_coupon_code_upper, v_user_id, v_subtotal);

    IF NOT (v_coupon_result->>'valid')::BOOLEAN THEN
      RAISE EXCEPTION 'Coupon error: %', COALESCE(v_coupon_result->>'message', v_coupon_result->>'reason')
        USING ERRCODE = 'P0005';
    END IF;

    v_coupon_discount := (v_coupon_result->>'discount')::NUMERIC;

    INSERT INTO coupon_usages (coupon_id, user_id, order_id)
    VALUES ((v_coupon_result->>'coupon_id')::UUID, v_user_id, v_order_id);

    UPDATE coupons SET times_used = COALESCE(times_used, 0) + 1
    WHERE id = (v_coupon_result->>'coupon_id')::UUID;
  END IF;

  -- UPDATE ORDER with server-computed totals
  v_total := v_subtotal - v_coupon_discount + v_delivery_fee;

  UPDATE orders
  SET total_amount = v_total,
      subtotal_amount = v_subtotal,
      delivery_fee = v_delivery_fee,
      coupon_code = CASE WHEN v_coupon_discount > 0 THEN v_coupon_code_upper ELSE NULL END,
      coupon_discount = v_coupon_discount
  WHERE id = v_order_id;

  -- LOG
  IF to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
    INSERT INTO public.warehouse_activity_log (
      action, entity_type, entity_id, actor_id, details
    ) VALUES (
      'order_placed_with_reservation',
      'order',
      v_order_id,
      v_user_id,
      jsonb_build_object(
        'status', v_status,
        'item_count', v_item_count,
        'total', v_total
      )
    );
  END IF;

  -- SUCCESS
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'status', v_status,
    'subtotal', v_subtotal,
    'coupon_discount', v_coupon_discount,
    'delivery_fee', v_delivery_fee,
    'total', v_total,
    'item_count', v_item_count,
    'idempotent', false
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION place_order(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, NUMERIC) TO authenticated;

-- 6. Fix assign_order_units: skip buy items (already assigned at order time)
CREATE OR REPLACE FUNCTION public.assign_order_units(
    p_order_id UUID,
    p_actor_id UUID DEFAULT auth.uid()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_item RECORD;
    v_unit RECORD;
    v_assigned_count INTEGER := 0;
BEGIN
    IF p_actor_id IS NULL OR NOT EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE user_id = p_actor_id
          AND role IN ('warehouse', 'admin')
    ) THEN
        RAISE EXCEPTION 'Only warehouse staff can assign physical units'
            USING ERRCODE = '42501';
    END IF;

    PERFORM 1
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Order not found: %', p_order_id
            USING ERRCODE = 'P0002';
    END IF;

    FOR v_item IN
        SELECT oi.id, oi.product_id, oi.size, oi.pricing_plan
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.individual_id IS NULL
          AND COALESCE(oi.pricing_plan, '3d') != 'buy'  -- skip buy items
        ORDER BY oi.id
    LOOP
        SELECT ap.individual_id, ap.inventory_id
        INTO v_unit
        FROM public.all_products ap
        JOIN public.inventory i ON i.id = ap.inventory_id
        WHERE i.product_id = v_item.product_id
          AND (
              v_item.size IS NULL
              OR i.size = v_item.size
              OR (i.size = 'OS' AND v_item.size = 'One Size')
              OR (i.size = 'One Size' AND v_item.size = 'OS')
          )
          AND COALESCE(ap.status, 'available') = 'available'
        ORDER BY ap.last_washed NULLS FIRST, ap.created_at, ap.individual_id
        FOR UPDATE OF ap SKIP LOCKED
        LIMIT 1;

        IF NOT FOUND THEN
            RAISE EXCEPTION
                'No available physical unit for product % size %',
                v_item.product_id,
                COALESCE(v_item.size, 'N/A')
                USING ERRCODE = '23514';
        END IF;

        UPDATE public.order_items
        SET individual_id = v_unit.individual_id
        WHERE id = v_item.id;

        UPDATE public.all_products
        SET status = 'rented',
            available = FALSE,
            last_rented = NOW(),
            times_rented = COALESCE(times_rented, 0) + 1
        WHERE individual_id = v_unit.individual_id;

        v_assigned_count := v_assigned_count + 1;
    END LOOP;

    IF v_assigned_count > 0 AND to_regclass('public.warehouse_activity_log') IS NOT NULL THEN
        INSERT INTO public.warehouse_activity_log (
            action,
            entity_type,
            entity_id,
            actor_id,
            details
        ) VALUES (
            'assign_order_units',
            'order',
            p_order_id,
            p_actor_id,
            jsonb_build_object('assigned_count', v_assigned_count)
        );
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'orderId', p_order_id,
        'assignedCount', v_assigned_count
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_order_units(UUID, UUID) TO authenticated;

-- 7. Updated release_order_stock: restores unit status on cancel
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
  v_unit        RECORD;
  v_units_restored INT := 0;
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

      PERFORM set_config('popclozet.reconciling_inventory_units', 'on', TRUE);

      UPDATE public.inventory
      SET available_stock = available_stock + v_restore_qty,
          rented_stock = rented_stock - v_restore_qty
      WHERE id = v_reservation.variant_id;

      PERFORM set_config('popclozet.reconciling_inventory_units', 'off', TRUE);
    END IF;

    -- Restore physical units back to available
    FOR v_unit IN
      SELECT ap.individual_id
      FROM public.all_products ap
      WHERE ap.inventory_id = v_reservation.variant_id
        AND ap.status IN ('rented', 'instantly_bought')
      ORDER BY ap.last_rented DESC NULLS LAST
      LIMIT v_reservation.quantity
      FOR UPDATE
    LOOP
      UPDATE public.all_products
      SET status = 'available', available = TRUE
      WHERE individual_id = v_unit.individual_id;
      v_units_restored := v_units_restored + 1;
    END LOOP;

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
      jsonb_build_object('reason', p_reason, 'reservations_released', v_released, 'units_restored', v_units_restored)
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'released', v_released,
    'units_restored', v_units_restored
  );
END;
$$;

-- 8. Fix confirm_razorpay_payment: buyout orders go to 'confirmed' not 'completed'
--    so they follow normal warehouse fulfillment flow (pack → dispatch → deliver)
CREATE OR REPLACE FUNCTION public.confirm_razorpay_payment(
  p_order_id            UUID,
  p_razorpay_order_id   TEXT,
  p_razorpay_payment_id TEXT,
  p_provider            TEXT DEFAULT 'razorpay'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_new_status TEXT;
  v_buy_result JSONB;
BEGIN
  SELECT id, user_id, status, total_amount, razorpay_order_id, order_type
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  IF v_order.status IN (
    'confirmed', 'paid', 'packed', 'ready_for_pickup',
    'dispatched', 'delivered', 'completed'
  ) THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
  END IF;

  IF v_order.status NOT IN ('pending', 'pending_payment', 'payment_failed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATE',
      'message', format('Cannot verify payment for order in state: %s', v_order.status)
    );
  END IF;

  IF v_order.razorpay_order_id IS NOT NULL
     AND v_order.razorpay_order_id != p_razorpay_order_id THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ORDER_MISMATCH',
      'message', 'Razorpay order ID does not match the stored value'
    );
  END IF;

  -- All orders (including buyout) go to 'confirmed' for warehouse fulfillment
  v_new_status := 'confirmed';

  UPDATE public.orders
  SET status = v_new_status,
      razorpay_order_id = p_razorpay_order_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO public.payments (
    user_id, order_id, amount, status, provider,
    razorpay_payment_id, razorpay_order_id
  ) VALUES (
    v_order.user_id, p_order_id, v_order.total_amount, 'completed', p_provider,
    p_razorpay_payment_id, p_razorpay_order_id
  );

  IF v_order.order_type IS DISTINCT FROM 'buyout'
     AND EXISTS (
       SELECT 1
       FROM public.order_items oi
       WHERE oi.order_id = p_order_id
         AND (
           COALESCE(oi.pricing_plan, '') = 'buy'
           OR COALESCE(oi.rental_duration_days, 0) = 0
         )
     ) THEN
    v_buy_result := public.finalize_catalogue_buy_stock(p_order_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'new_status', v_new_status,
    'payment_id', p_razorpay_payment_id,
    'catalogue_buy_stock', COALESCE(v_buy_result, '{}'::JSONB)
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

-- Fix this specific order back to confirmed
UPDATE public.orders SET status = 'confirmed' WHERE id = 'b6df652b-63c8-4675-8f87-51edaa6dff79' AND status = 'completed';

NOTIFY pgrst, 'reload schema';
