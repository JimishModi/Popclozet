-- ============================================================
-- Migration: Cap ARJUN50 free-delivery waiver at ₹60
-- Date: 2026-04-14
--
-- Behaviour change:
--   ARJUN50 previously waived the entire delivery fee. Now the
--   waiver is capped at ₹60 — if delivery > 60, customer pays
--   the excess; if delivery ≤ 60, delivery is free.
-- ============================================================

CREATE OR REPLACE FUNCTION public.preview_order_core(
  p_items JSONB,
  p_coupon_code TEXT DEFAULT NULL,
  p_distance_km NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_item JSONB;
  v_product RECORD;
  v_quantity INT;
  v_unit_price NUMERIC;
  v_line_total NUMERIC;
  v_subtotal NUMERIC := 0;
  v_original_total NUMERIC := 0;
  v_delivery_fee NUMERIC;
  v_delivery_discount NUMERIC := 0;
  v_coupon_result JSONB;
  v_coupon_discount NUMERIC := 0;
  v_coupon_free_delivery BOOLEAN := false;
  v_total NUMERIC;
  v_items_detail JSONB := '[]'::JSONB;
  v_product_mrp_expr TEXT := 'NULL::NUMERIC';
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'mrp'
  ) THEN
    v_product_mrp_expr := 'p.mrp';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'mrp_price'
  ) THEN
    v_product_mrp_expr := 'p.mrp_price';
  END IF;

  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_CART');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_product := NULL;

    EXECUTE format(
      'SELECT p.id, p.rental_price, p.rental_price_1d, p.rental_price_2d, p.rental_price_3d,
              p.buy_price, %s AS mrp, p.is_available
       FROM public.products p WHERE p.id = $1',
      v_product_mrp_expr
    )
    INTO v_product
    USING (v_item->>'product_id')::UUID;

    IF v_product IS NULL OR v_product.id IS NULL THEN
      RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_NOT_FOUND',
        'message', format('Product %s not found', v_item->>'product_id'));
    END IF;

    v_quantity := GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);

    v_unit_price := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN COALESCE(v_product.rental_price_1d, v_product.rental_price)
      WHEN '2d' THEN COALESCE(v_product.rental_price_2d, v_product.rental_price)
      WHEN '3d' THEN COALESCE(v_product.rental_price_3d, v_product.rental_price)
      WHEN 'buy' THEN COALESCE(v_product.buy_price, v_product.rental_price * 5)
      ELSE v_product.rental_price
    END;

    v_line_total := v_unit_price * v_quantity;
    v_subtotal := v_subtotal + v_line_total;
    v_original_total := v_original_total + (COALESCE(v_product.mrp, v_unit_price) * v_quantity);

    v_items_detail := v_items_detail || jsonb_build_object(
      'product_id', v_product.id, 'unit_price', v_unit_price,
      'quantity', v_quantity, 'line_total', v_line_total,
      'mrp', COALESCE(v_product.mrp, v_unit_price)
    );
  END LOOP;

  v_delivery_fee := compute_delivery_fee(p_distance_km);

  IF v_delivery_fee = -1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'OUT_OF_RANGE',
      'message', 'Sorry, this area is outside our delivery range (max 7km).');
  END IF;

  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    v_coupon_result := validate_coupon(UPPER(TRIM(p_coupon_code)), v_user_id, v_subtotal);
    IF (v_coupon_result->>'valid')::BOOLEAN THEN
      v_coupon_discount := (v_coupon_result->>'discount')::NUMERIC;
      v_coupon_free_delivery := COALESCE((v_coupon_result->>'free_delivery')::BOOLEAN, false);
    END IF;
  ELSE
    v_coupon_result := jsonb_build_object('valid', false, 'reason', 'NO_CODE');
  END IF;

  -- Free-delivery coupon: waive up to ₹60; customer pays excess over ₹60.
  IF v_coupon_free_delivery THEN
    v_delivery_discount := LEAST(v_delivery_fee, 60);
    v_delivery_fee := v_delivery_fee - v_delivery_discount;
  END IF;

  v_total := v_subtotal - v_coupon_discount + v_delivery_fee;

  RETURN jsonb_build_object(
    'success', true,
    'original_total', v_original_total,
    'subtotal', v_subtotal,
    'discount', v_original_total - v_subtotal,
    'coupon', v_coupon_result,
    'coupon_discount', v_coupon_discount,
    'delivery_fee', v_delivery_fee,
    'delivery_discount', v_delivery_discount,
    'total', v_total,
    'items', v_items_detail
  );
END;
$$;

CREATE OR REPLACE FUNCTION place_order(
  p_idempotency_key    TEXT,
  p_address_id         UUID,
  p_start_date         TIMESTAMPTZ,
  p_end_date           TIMESTAMPTZ,
  p_payment_method     TEXT,
  p_coupon_code        TEXT DEFAULT NULL,
  p_route_distance_km  NUMERIC DEFAULT 0,
  p_delivery_eta       TIMESTAMPTZ DEFAULT NULL,
  p_return_pickup_date TEXT DEFAULT NULL,
  p_return_time_slot   TEXT DEFAULT NULL,
  p_items              JSONB DEFAULT NULL
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
  v_unit_price      NUMERIC;
  v_line_total      NUMERIC;
  v_subtotal        NUMERIC := 0;
  v_delivery_fee    NUMERIC;
  v_delivery_discount NUMERIC := 0;
  v_coupon_result   JSONB;
  v_coupon_discount NUMERIC := 0;
  v_coupon_free_delivery BOOLEAN := false;
  v_coupon_code_upper TEXT;
  v_total           NUMERIC;
  v_status          TEXT;
  v_plan_days       INT;
  v_item_count      INT := 0;
  v_addr_lat        DOUBLE PRECISION;
  v_addr_lng        DOUBLE PRECISION;
  v_haversine_dist  DOUBLE PRECISION;
  v_wh_lat CONSTANT DOUBLE PRECISION := 19.1367;
  v_wh_lng CONSTANT DOUBLE PRECISION := 72.9125;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to place an order');
  END IF;

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

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_CART',
      'message', 'Cannot place an order with no items');
  END IF;

  SELECT latitude, longitude INTO v_addr_lat, v_addr_lng
  FROM addresses WHERE id = p_address_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ADDRESS',
      'message', 'Delivery address not found or does not belong to you');
  END IF;

  IF v_addr_lat IS NOT NULL AND v_addr_lng IS NOT NULL
     AND v_addr_lat != 0 AND v_addr_lng != 0 THEN
    v_haversine_dist := haversine_km(v_wh_lat, v_wh_lng, v_addr_lat, v_addr_lng);
    v_delivery_fee := compute_delivery_fee(v_haversine_dist);
  ELSE
    v_delivery_fee := compute_delivery_fee(p_route_distance_km);
    v_haversine_dist := p_route_distance_km;
  END IF;

  IF v_delivery_fee = -1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'OUT_OF_RANGE',
      'message', 'Sorry, this area is outside our delivery range (max 7km).');
  END IF;

  IF p_payment_method = 'cod' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
  END IF;

  INSERT INTO orders (
    user_id, delivery_address_id, rental_start_date, rental_end_date,
    total_amount, delivery_eta, status, payment_method,
    delivery_fee, route_distance_km, return_pickup_date, return_time_slot,
    idempotency_key
  ) VALUES (
    v_user_id, p_address_id, p_start_date, p_end_date,
    0, p_delivery_eta, v_status, p_payment_method,
    v_delivery_fee, v_haversine_dist,
    NULLIF(p_return_pickup_date, '')::DATE, p_return_time_slot,
    p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, rental_price, rental_price_1d, rental_price_2d, rental_price_3d,
           buy_price, is_available
    INTO v_product
    FROM products WHERE id = (v_item->>'product_id')::UUID;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product % not found', v_item->>'product_id' USING ERRCODE = 'P0002';
    END IF;

    IF v_product.is_available IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Product % is not available for rent', v_item->>'product_id' USING ERRCODE = 'P0003';
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
        v_item->>'product_id', COALESCE(v_item->>'plan', '3d') USING ERRCODE = 'P0004';
    END IF;

    v_plan_days := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN 1 WHEN '2d' THEN 2 WHEN '3d' THEN 3 WHEN 'buy' THEN 0 ELSE 3
    END;

    v_line_total := v_unit_price * GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);

    INSERT INTO order_items (order_id, product_id, size, rental_price, rental_duration_days, pricing_plan)
    VALUES (v_order_id, v_product.id, COALESCE(v_item->>'size', 'One Size'),
            v_line_total, v_plan_days, COALESCE(v_item->>'plan', '3d'));

    v_subtotal := v_subtotal + v_line_total;
    v_item_count := v_item_count + 1;
  END LOOP;

  v_coupon_code_upper := UPPER(TRIM(COALESCE(p_coupon_code, '')));
  IF v_coupon_code_upper != '' THEN
    v_coupon_result := validate_coupon(v_coupon_code_upper, v_user_id, v_subtotal);

    IF NOT (v_coupon_result->>'valid')::BOOLEAN THEN
      RAISE EXCEPTION 'Coupon error: %', COALESCE(v_coupon_result->>'message', v_coupon_result->>'reason')
        USING ERRCODE = 'P0005';
    END IF;

    v_coupon_discount := (v_coupon_result->>'discount')::NUMERIC;
    v_coupon_free_delivery := COALESCE((v_coupon_result->>'free_delivery')::BOOLEAN, false);

    INSERT INTO coupon_usages (coupon_id, user_id, order_id)
    VALUES ((v_coupon_result->>'coupon_id')::UUID, v_user_id, v_order_id);

    UPDATE coupons SET times_used = COALESCE(times_used, 0) + 1
    WHERE id = (v_coupon_result->>'coupon_id')::UUID;
  END IF;

  -- Free-delivery coupon: waive up to ₹60; customer pays excess over ₹60.
  IF v_coupon_free_delivery THEN
    v_delivery_discount := LEAST(v_delivery_fee, 60);
    v_delivery_fee := v_delivery_fee - v_delivery_discount;
  END IF;

  v_total := v_subtotal - v_coupon_discount + v_delivery_fee;

  UPDATE orders
  SET total_amount = v_total,
      subtotal_amount = v_subtotal,
      delivery_fee = v_delivery_fee,
      coupon_code = CASE WHEN v_coupon_discount > 0 OR v_coupon_free_delivery THEN v_coupon_code_upper ELSE NULL END,
      coupon_discount = v_coupon_discount
  WHERE id = v_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'status', v_status,
    'subtotal', v_subtotal,
    'coupon_discount', v_coupon_discount,
    'delivery_fee', v_delivery_fee,
    'delivery_discount', v_delivery_discount,
    'total', v_total,
    'item_count', v_item_count,
    'idempotent', false
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'code', SQLSTATE, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_order_core(JSONB, TEXT, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION place_order(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
