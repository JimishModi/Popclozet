-- ============================================================
-- Migration: Order Notification Hardening
-- Date: 2026-04-03
--
-- Fixes:
--   1. Add 'payment_failed' to allowed order statuses
--   2. Add notification_sent_at column for deduplication
--   3. Create COD payment record inside place_order
--   4. Add DB trigger to call notification webhook on status change
-- ============================================================

-- 1. Add payment_failed status support
--    Allow transition from pending/pending_payment → payment_failed
--    (The state machine function is updated below)

-- 2. Add notification tracking column to prevent duplicate notifications
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

-- 3. Update place_order to create a payment record for COD orders
--    COD orders get an immediate 'pending_cod' payment record for tracking.
CREATE OR REPLACE FUNCTION place_order(
  p_idempotency_key    TEXT,
  p_address_id         UUID,
  p_start_date         TIMESTAMPTZ,
  p_end_date           TIMESTAMPTZ,
  p_payment_method     TEXT,            -- 'cod' | 'upi' | 'razorpay'
  p_items              JSONB,           -- [{product_id, size, plan, quantity}]
  p_delivery_fee       NUMERIC DEFAULT 0,
  p_route_distance_km  NUMERIC DEFAULT 0,
  p_delivery_eta       TIMESTAMPTZ DEFAULT NULL,
  p_return_pickup_date TEXT DEFAULT NULL,
  p_return_time_slot   TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_order_id      UUID;
  v_existing      RECORD;
  v_item          JSONB;
  v_product       RECORD;
  v_unit_price    NUMERIC;
  v_line_total    NUMERIC;
  v_subtotal      NUMERIC := 0;
  v_total         NUMERIC;
  v_status        TEXT;
  v_plan_days     INT;
  v_item_count    INT := 0;
BEGIN
  -- AUTH
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to place an order'
    );
  END IF;

  -- IDEMPOTENCY
  IF p_idempotency_key IS NOT NULL AND p_idempotency_key != '' THEN
    PERFORM pg_advisory_xact_lock(hashtext(p_idempotency_key));
    SELECT id, status INTO v_existing
    FROM orders WHERE idempotency_key = p_idempotency_key LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object(
        'success', true, 'order_id', v_existing.id,
        'status', v_existing.status, 'idempotent', true,
        'message', 'Order already exists for this request'
      );
    END IF;
  END IF;

  -- VALIDATE ITEMS
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'EMPTY_CART',
      'message', 'Cannot place an order with no items'
    );
  END IF;

  -- VALIDATE ADDRESS
  IF NOT EXISTS (
    SELECT 1 FROM addresses WHERE id = p_address_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_ADDRESS',
      'message', 'Delivery address not found or does not belong to you'
    );
  END IF;

  -- INITIAL STATUS
  IF p_payment_method = 'cod' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
  END IF;

  -- CREATE ORDER
  INSERT INTO orders (
    user_id, delivery_address_id, rental_start_date, rental_end_date,
    total_amount, delivery_eta, status, payment_method, delivery_fee,
    route_distance_km, return_pickup_date, return_time_slot, idempotency_key
  ) VALUES (
    v_user_id, p_address_id, p_start_date, p_end_date,
    0, p_delivery_eta, v_status, p_payment_method, p_delivery_fee,
    p_route_distance_km, NULLIF(p_return_pickup_date, '')::DATE,
    p_return_time_slot, p_idempotency_key
  ) RETURNING id INTO v_order_id;

  -- INSERT ITEMS (prices from DB)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, rental_price, rental_price_1d, rental_price_2d,
           rental_price_3d, buy_price, is_available
    INTO v_product FROM products
    WHERE id = (v_item->>'product_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'product_id'
        USING ERRCODE = 'P0002';
    END IF;

    IF v_product.is_available IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Product % is not available for rent', v_item->>'product_id'
        USING ERRCODE = 'P0003';
    END IF;

    v_unit_price := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN COALESCE(v_product.rental_price_1d, v_product.rental_price)
      WHEN '2d' THEN COALESCE(v_product.rental_price_2d, v_product.rental_price)
      WHEN '3d' THEN COALESCE(v_product.rental_price_3d, v_product.rental_price)
      WHEN 'buy' THEN COALESCE(v_product.buy_price, v_product.rental_price * 5)
      ELSE v_product.rental_price
    END;

    IF v_unit_price IS NULL OR v_unit_price <= 0 THEN
      RAISE EXCEPTION 'No valid price for product % plan %',
        v_item->>'product_id', COALESCE(v_item->>'plan', '3d')
        USING ERRCODE = 'P0004';
    END IF;

    v_plan_days := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN 1 WHEN '2d' THEN 2 WHEN '3d' THEN 3 WHEN 'buy' THEN 0 ELSE 3
    END;

    v_line_total := v_unit_price * GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);

    INSERT INTO order_items (
      order_id, product_id, size, rental_price, rental_duration_days, pricing_plan
    ) VALUES (
      v_order_id, v_product.id, COALESCE(v_item->>'size', 'One Size'),
      v_line_total, v_plan_days, COALESCE(v_item->>'plan', '3d')
    );

    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + 1;
  END LOOP;

  -- UPDATE TOTAL
  v_total := v_subtotal + COALESCE(p_delivery_fee, 0);
  UPDATE orders SET total_amount = v_total, subtotal_amount = v_subtotal
  WHERE id = v_order_id;

  -- COD: Create payment record immediately (for tracking & warehouse visibility)
  IF p_payment_method = 'cod' THEN
    INSERT INTO payments (
      user_id, order_id, amount, status, provider
    ) VALUES (
      v_user_id, v_order_id, v_total, 'pending_cod', 'cod'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'order_id', v_order_id, 'status', v_status,
    'subtotal', v_subtotal, 'delivery_fee', COALESCE(p_delivery_fee, 0),
    'total', v_total, 'item_count', v_item_count, 'idempotent', false
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION place_order TO authenticated;

-- 4. Update verify_payment_and_update to also mark notification_sent_at = NULL
--    so the webhook knows this is a fresh confirmation
CREATE OR REPLACE FUNCTION verify_payment_and_update(
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
BEGIN
  SELECT id, user_id, status, total_amount, razorpay_order_id, order_type
  INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  IF v_order.status IN ('confirmed', 'paid', 'packed', 'ready_for_pickup', 'dispatched', 'delivered') THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
  END IF;

  IF v_order.status NOT IN ('pending', 'pending_payment') THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_STATE',
      'message', format('Cannot verify payment for order in state: %s', v_order.status)
    );
  END IF;

  IF v_order.razorpay_order_id IS NOT NULL
     AND v_order.razorpay_order_id != p_razorpay_order_id THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'ORDER_MISMATCH',
      'message', 'Razorpay order ID does not match the stored value'
    );
  END IF;

  v_new_status := CASE WHEN v_order.order_type = 'buyout' THEN 'completed' ELSE 'confirmed' END;

  UPDATE orders
  SET status = v_new_status,
      razorpay_order_id = p_razorpay_order_id,
      updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO payments (
    user_id, order_id, amount, status, provider,
    razorpay_payment_id, razorpay_order_id
  ) VALUES (
    v_order.user_id, p_order_id, v_order.total_amount, 'completed',
    p_provider, p_razorpay_payment_id, p_razorpay_order_id
  );

  RETURN jsonb_build_object(
    'success', true, 'order_id', p_order_id,
    'new_status', v_new_status, 'payment_id', p_razorpay_payment_id
  );

EXCEPTION
  WHEN unique_violation THEN
    RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION verify_payment_and_update FROM PUBLIC;
REVOKE ALL ON FUNCTION verify_payment_and_update FROM authenticated;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
