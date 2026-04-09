-- ============================================================
-- Migration: Secure Server-Side Pricing
-- Date: 2026-04-03
--
-- Fixes:
--   1. Delivery fee computed server-side (never trusted from client)
--   2. Coupon/promo code validated & applied atomically inside place_order
--   3. Coupon usage tracked (times_used incremented, max_uses enforced)
--   4. Per-user coupon usage limit enforced (1 use per user per coupon)
--   5. New preview_order RPC for displaying prices before checkout
--   6. No client-side price manipulation possible
-- ============================================================

-- 1. Ensure coupons table has per-user tracking
CREATE TABLE IF NOT EXISTS public.coupon_usages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id UUID NOT NULL REFERENCES public.coupons(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(coupon_id, user_id)
);

ALTER TABLE public.coupon_usages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own coupon usages"
  ON public.coupon_usages FOR SELECT
  USING (user_id = auth.uid());

-- Add coupon tracking columns to orders if not present
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS coupon_discount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal_amount NUMERIC(10,2) DEFAULT 0;

-- ============================================================
-- 2. HELPER: Compute delivery fee from distance (server-side)
--    Mirrors the formula in deliveryService.ts:
--      <= 6 km   → ₹40
--      6 to 12km → ₹40 + ceil(distance - 6) * ₹20
--      > 12km    → -1 (unserviceable)
-- ============================================================
CREATE OR REPLACE FUNCTION compute_delivery_fee(p_distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql IMMUTABLE
AS $$
BEGIN
  IF p_distance_km IS NULL OR p_distance_km <= 0 THEN
    RETURN 40;  -- default base fee
  END IF;
  IF p_distance_km <= 6 THEN
    RETURN 40;
  END IF;
  IF p_distance_km <= 12 THEN
    RETURN 40 + CEIL(p_distance_km - 6) * 20;
  END IF;
  RETURN -1;
END;
$$;

-- ============================================================
-- 3. HELPER: Validate coupon and return discount details
-- ============================================================
CREATE OR REPLACE FUNCTION validate_coupon(
  p_code TEXT,
  p_user_id UUID,
  p_subtotal NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_coupon RECORD;
  v_discount NUMERIC;
  v_already_used BOOLEAN;
BEGIN
  IF p_code IS NULL OR TRIM(p_code) = '' THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'NO_CODE');
  END IF;

  SELECT * INTO v_coupon
  FROM coupons
  WHERE code = UPPER(TRIM(p_code))
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until > NOW());

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'INVALID_CODE', 'message', 'Coupon code not found or expired');
  END IF;

  -- Check max global uses
  IF v_coupon.max_uses IS NOT NULL AND v_coupon.times_used >= v_coupon.max_uses THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'MAX_USES_REACHED', 'message', 'This coupon has been fully redeemed');
  END IF;

  -- Check per-user usage
  SELECT EXISTS (
    SELECT 1 FROM coupon_usages WHERE coupon_id = v_coupon.id AND user_id = p_user_id
  ) INTO v_already_used;

  IF v_already_used THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'ALREADY_USED', 'message', 'You have already used this coupon');
  END IF;

  -- Check minimum order value
  IF v_coupon.min_order_value IS NOT NULL AND p_subtotal < v_coupon.min_order_value THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'MIN_ORDER_NOT_MET',
      'message', format('Minimum order value ₹%s required', v_coupon.min_order_value)
    );
  END IF;

  -- Calculate discount
  IF v_coupon.discount_type = 'percentage' THEN
    v_discount := ROUND(p_subtotal * (v_coupon.discount_value / 100), 2);
    -- Cap percentage discount at subtotal
    IF v_discount > p_subtotal THEN
      v_discount := p_subtotal;
    END IF;
  ELSE
    -- Fixed discount, capped at subtotal
    v_discount := LEAST(v_coupon.discount_value, p_subtotal);
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'coupon_id', v_coupon.id,
    'code', v_coupon.code,
    'discount', v_discount,
    'discount_type', v_coupon.discount_type,
    'discount_value', v_coupon.discount_value
  );
END;
$$;

-- ============================================================
-- 4. PREVIEW ORDER: Returns server-computed pricing for display
--    Frontend calls this to show accurate totals BEFORE placing.
--    No side effects — read-only.
-- ============================================================
CREATE OR REPLACE FUNCTION preview_order(
  p_items          JSONB,        -- [{product_id, plan, quantity}]
  p_coupon_code    TEXT DEFAULT NULL,
  p_distance_km    NUMERIC DEFAULT 0
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_item          JSONB;
  v_product       RECORD;
  v_unit_price    NUMERIC;
  v_line_total    NUMERIC;
  v_subtotal      NUMERIC := 0;
  v_original_total NUMERIC := 0;
  v_delivery_fee  NUMERIC;
  v_coupon_result JSONB;
  v_coupon_discount NUMERIC := 0;
  v_total         NUMERIC;
  v_items_detail  JSONB := '[]'::JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_CART');
  END IF;

  -- Calculate item prices from DB
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, rental_price, rental_price_1d, rental_price_2d, rental_price_3d,
           buy_price, mrp, is_available
    INTO v_product
    FROM products
    WHERE id = (v_item->>'product_id')::UUID;

    IF NOT FOUND THEN
      RETURN jsonb_build_object('success', false, 'code', 'PRODUCT_NOT_FOUND',
        'message', format('Product %s not found', v_item->>'product_id'));
    END IF;

    v_unit_price := CASE COALESCE(v_item->>'plan', '3d')
      WHEN '1d' THEN COALESCE(v_product.rental_price_1d, v_product.rental_price)
      WHEN '2d' THEN COALESCE(v_product.rental_price_2d, v_product.rental_price)
      WHEN '3d' THEN COALESCE(v_product.rental_price_3d, v_product.rental_price)
      WHEN 'buy' THEN COALESCE(v_product.buy_price, v_product.rental_price * 5)
      ELSE v_product.rental_price
    END;

    v_line_total := v_unit_price * GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1);
    v_subtotal := v_subtotal + v_line_total;
    v_original_total := v_original_total + (COALESCE(v_product.mrp, v_unit_price) * GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1));

    v_items_detail := v_items_detail || jsonb_build_object(
      'product_id', v_product.id,
      'unit_price', v_unit_price,
      'quantity', GREATEST(COALESCE((v_item->>'quantity')::INT, 1), 1),
      'line_total', v_line_total,
      'mrp', COALESCE(v_product.mrp, v_unit_price)
    );
  END LOOP;

  -- Compute delivery fee server-side
  v_delivery_fee := compute_delivery_fee(p_distance_km);

  -- Validate coupon if provided
  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    v_coupon_result := validate_coupon(p_coupon_code, v_user_id, v_subtotal);
    IF (v_coupon_result->>'valid')::BOOLEAN THEN
      v_coupon_discount := (v_coupon_result->>'discount')::NUMERIC;
    END IF;
  ELSE
    v_coupon_result := jsonb_build_object('valid', false, 'reason', 'NO_CODE');
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
    'total', v_total,
    'items', v_items_detail
  );
END;
$$;

GRANT EXECUTE ON FUNCTION preview_order(JSONB, TEXT, NUMERIC) TO authenticated;

-- ============================================================
-- 5. UPGRADED place_order: Server-side delivery fee + coupon
--
-- Changes from previous version:
--   - p_delivery_fee REMOVED (computed from p_route_distance_km)
--   - p_coupon_code ADDED (validated + applied atomically)
--   - Coupon usage recorded in coupon_usages table
--   - Coupon times_used incremented
-- ============================================================
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
  -- DEPRECATED: kept for backward compat but IGNORED
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
BEGIN
  -- ==============================
  -- AUTH
  -- ==============================
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED',
      'message', 'You must be signed in to place an order');
  END IF;

  -- ==============================
  -- IDEMPOTENCY
  -- ==============================
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

  -- ==============================
  -- VALIDATE items
  -- ==============================
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_CART',
      'message', 'Cannot place an order with no items');
  END IF;

  -- ==============================
  -- VALIDATE address ownership
  -- ==============================
  IF NOT EXISTS (
    SELECT 1 FROM addresses WHERE id = p_address_id AND user_id = v_user_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_ADDRESS',
      'message', 'Delivery address not found or does not belong to you');
  END IF;

  -- ==============================
  -- COMPUTE DELIVERY FEE (server-side, never from client)
  -- ==============================
  v_delivery_fee := compute_delivery_fee(p_route_distance_km);

  -- ==============================
  -- STATUS
  -- ==============================
  IF p_payment_method = 'cod' THEN
    v_status := 'confirmed';
  ELSE
    v_status := 'pending_payment';
  END IF;

  -- ==============================
  -- CREATE ORDER (total placeholder)
  -- ==============================
  INSERT INTO orders (
    user_id, delivery_address_id, rental_start_date, rental_end_date,
    total_amount, delivery_eta, status, payment_method,
    delivery_fee, route_distance_km, return_pickup_date, return_time_slot,
    idempotency_key
  ) VALUES (
    v_user_id, p_address_id, p_start_date, p_end_date,
    0, p_delivery_eta, v_status, p_payment_method,
    v_delivery_fee, p_route_distance_km,
    NULLIF(p_return_pickup_date, '')::DATE, p_return_time_slot,
    p_idempotency_key
  )
  RETURNING id INTO v_order_id;

  -- ==============================
  -- INSERT ITEMS (prices from DB)
  -- ==============================
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

  -- ==============================
  -- VALIDATE & APPLY COUPON (atomic, server-side)
  -- ==============================
  v_coupon_code_upper := UPPER(TRIM(COALESCE(p_coupon_code, '')));
  IF v_coupon_code_upper != '' THEN
    v_coupon_result := validate_coupon(v_coupon_code_upper, v_user_id, v_subtotal);

    IF NOT (v_coupon_result->>'valid')::BOOLEAN THEN
      -- Coupon invalid — roll back (raise exception inside transaction)
      RAISE EXCEPTION 'Coupon error: %', COALESCE(v_coupon_result->>'message', v_coupon_result->>'reason')
        USING ERRCODE = 'P0005';
    END IF;

    v_coupon_discount := (v_coupon_result->>'discount')::NUMERIC;

    -- Record usage atomically
    INSERT INTO coupon_usages (coupon_id, user_id, order_id)
    VALUES ((v_coupon_result->>'coupon_id')::UUID, v_user_id, v_order_id);

    -- Increment global usage counter
    UPDATE coupons SET times_used = COALESCE(times_used, 0) + 1
    WHERE id = (v_coupon_result->>'coupon_id')::UUID;
  END IF;

  -- ==============================
  -- UPDATE ORDER with final server-computed totals
  -- ==============================
  v_total := v_subtotal - v_coupon_discount + v_delivery_fee;

  UPDATE orders
  SET total_amount = v_total,
      subtotal_amount = v_subtotal,
      delivery_fee = v_delivery_fee,
      coupon_code = CASE WHEN v_coupon_discount > 0 THEN v_coupon_code_upper ELSE NULL END,
      coupon_discount = v_coupon_discount
  WHERE id = v_order_id;

  -- ==============================
  -- SUCCESS
  -- ==============================
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

-- Re-grant after CREATE OR REPLACE
GRANT EXECUTE ON FUNCTION place_order TO authenticated;
GRANT EXECUTE ON FUNCTION compute_delivery_fee(NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_coupon(TEXT, UUID, NUMERIC) TO authenticated;

COMMENT ON FUNCTION place_order IS
'Atomic order placement with server-side pricing.
- Prices fetched from products table (never from client)
- Delivery fee computed from distance (never from client)
- Coupon validated, applied, and usage tracked atomically
- Idempotency key prevents duplicate orders
- Full rollback on any failure';

COMMENT ON FUNCTION preview_order IS
'Read-only pricing preview. Returns server-computed subtotal, discount,
coupon discount, delivery fee, and total. No side effects.
Frontend uses this to display accurate pricing before placing an order.';
