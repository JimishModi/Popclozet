-- Migration: Fix preview_order distance check
-- Problem: Client sends road distance which can be >7km even when haversine is <7km.
--          The AddressSelectionPage uses haversine but preview_order used road distance.
-- Fix:     Compute haversine server-side from warehouse to address lat/lng.
--          This makes the server check consistent with the client-side check.

-- 1. Haversine distance function (km) — pure math, no external calls
CREATE OR REPLACE FUNCTION haversine_km(
  lat1 DOUBLE PRECISION,
  lng1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lng2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  R CONSTANT DOUBLE PRECISION := 6371.0;
  d_lat DOUBLE PRECISION;
  d_lng DOUBLE PRECISION;
  a DOUBLE PRECISION;
BEGIN
  d_lat := RADIANS(lat2 - lat1);
  d_lng := RADIANS(lng2 - lng1);
  a := SIN(d_lat / 2) ^ 2
     + COS(RADIANS(lat1)) * COS(RADIANS(lat2)) * SIN(d_lng / 2) ^ 2;
  RETURN R * 2 * ATAN2(SQRT(a), SQRT(1 - a));
END;
$$;

-- 2. Add DOUBLE PRECISION overload of compute_delivery_fee
--    so haversine_km output can be passed directly without cast
CREATE OR REPLACE FUNCTION compute_delivery_fee(p_distance_km DOUBLE PRECISION)
RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_distance_km IS NULL OR p_distance_km <= 0 THEN
    RETURN 60;
  END IF;
  IF p_distance_km <= 7 THEN
    RETURN 60;
  END IF;
  RETURN -1;
END;
$$;

-- 3. Update the 6-param preview_order overload to compute haversine server-side
--    instead of trusting client-sent p_distance_km
DROP FUNCTION IF EXISTS public.preview_order(JSONB, TEXT, UUID, NUMERIC, NUMERIC, NUMERIC);

CREATE FUNCTION public.preview_order(
  p_items JSONB,
  p_coupon_code TEXT,
  p_address_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC,
  p_distance_km NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_distance NUMERIC;
  -- Warehouse: H2, IIT Bombay, Powai
  v_wh_lat CONSTANT DOUBLE PRECISION := 19.1367;
  v_wh_lng CONSTANT DOUBLE PRECISION := 72.9125;
BEGIN
  -- Compute haversine distance server-side when lat/lng provided
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL
     AND p_lat != 0 AND p_lng != 0 THEN
    v_distance := haversine_km(v_wh_lat, v_wh_lng, p_lat::DOUBLE PRECISION, p_lng::DOUBLE PRECISION);
  ELSE
    -- Fallback to client-sent distance (or 0)
    v_distance := COALESCE(p_distance_km, 0);
  END IF;

  RETURN public.preview_order_core(p_items, p_coupon_code, v_distance);
END;
$$;

-- 4. Update the 5-param overload (address_id + lat/lng, no distance) similarly
DROP FUNCTION IF EXISTS public.preview_order(JSONB, TEXT, UUID, NUMERIC, NUMERIC);

CREATE FUNCTION public.preview_order(
  p_items JSONB,
  p_coupon_code TEXT,
  p_address_id UUID,
  p_lat NUMERIC,
  p_lng NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_distance NUMERIC;
  v_wh_lat CONSTANT DOUBLE PRECISION := 19.1367;
  v_wh_lng CONSTANT DOUBLE PRECISION := 72.9125;
BEGIN
  IF p_lat IS NOT NULL AND p_lng IS NOT NULL
     AND p_lat != 0 AND p_lng != 0 THEN
    v_distance := haversine_km(v_wh_lat, v_wh_lng, p_lat::DOUBLE PRECISION, p_lng::DOUBLE PRECISION);
  ELSE
    v_distance := 0;
  END IF;

  RETURN public.preview_order_core(p_items, p_coupon_code, v_distance);
END;
$$;

-- 5. Update place_order to compute delivery fee from address lat/lng (haversine)
--    instead of trusting client-sent p_route_distance_km
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
  p_delivery_fee       NUMERIC DEFAULT NULL  -- DEPRECATED, ignored
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
  v_coupon_result   JSONB;
  v_coupon_discount NUMERIC := 0;
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

  -- VALIDATE address ownership + get lat/lng for haversine
  SELECT latitude, longitude INTO v_addr_lat, v_addr_lng
  FROM addresses WHERE id = p_address_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ADDRESS',
      'message', 'Delivery address not found or does not belong to you');
  END IF;

  -- COMPUTE DELIVERY FEE using haversine from address coords
  IF v_addr_lat IS NOT NULL AND v_addr_lng IS NOT NULL
     AND v_addr_lat != 0 AND v_addr_lng != 0 THEN
    v_haversine_dist := haversine_km(v_wh_lat, v_wh_lng, v_addr_lat, v_addr_lng);
    v_delivery_fee := compute_delivery_fee(v_haversine_dist);
  ELSE
    -- Fallback to client distance if no coords in DB
    v_delivery_fee := compute_delivery_fee(p_route_distance_km);
    v_haversine_dist := p_route_distance_km;
  END IF;

  -- REJECT if out of range
  IF v_delivery_fee = -1 THEN
    RETURN jsonb_build_object('success', false, 'code', 'OUT_OF_RANGE',
      'message', 'Sorry, this area is outside our delivery range (max 7km).');
  END IF;

  -- STATUS
  IF p_payment_method = 'cod' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
  END IF;

  -- CREATE ORDER
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

  -- INSERT ITEMS (prices from DB)
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

  -- UPDATE ORDER with final totals
  v_total := v_subtotal - v_coupon_discount + v_delivery_fee;

  UPDATE orders
  SET total_amount = v_total,
      subtotal_amount = v_subtotal,
      delivery_fee = v_delivery_fee,
      coupon_code = CASE WHEN v_coupon_discount > 0 THEN v_coupon_code_upper ELSE NULL END,
      coupon_discount = v_coupon_discount
  WHERE id = v_order_id;

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

-- Re-grant permissions
GRANT EXECUTE ON FUNCTION compute_delivery_fee(DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION haversine_km(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_order(JSONB, TEXT, UUID, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.preview_order(JSONB, TEXT, UUID, NUMERIC, NUMERIC, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION place_order(TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, JSONB, TEXT, NUMERIC, TIMESTAMPTZ, TEXT, TEXT, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';
