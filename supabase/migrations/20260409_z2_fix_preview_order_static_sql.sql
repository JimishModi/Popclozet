-- Fix: Replace dynamic EXECUTE format() in preview_order_core with static SQL.
-- Root cause: EXECUTE (dynamic SQL) does not consistently bypass the products
-- RLS policy (is_available = TRUE) even inside a SECURITY DEFINER function.
-- Static SQL correctly runs under the SECURITY DEFINER context and bypasses RLS,
-- matching the behaviour of place_order which uses static SQL and works fine.
-- The mrp_price column was already removed by 20260409_fix_products_mrp_column_cleanup.sql
-- so we can use p.mrp directly.

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
  v_coupon_result JSONB;
  v_coupon_discount NUMERIC := 0;
  v_total NUMERIC;
  v_items_detail JSONB := '[]'::JSONB;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'EMPTY_CART');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Static SQL: correctly bypasses RLS under SECURITY DEFINER,
    -- so products with is_available = FALSE are still visible here.
    SELECT
      p.id,
      p.rental_price,
      p.rental_price_1d,
      p.rental_price_2d,
      p.rental_price_3d,
      p.buy_price,
      p.mrp,
      p.is_available
    INTO v_product
    FROM public.products p
    WHERE p.id = (v_item->>'product_id')::UUID;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'PRODUCT_NOT_FOUND',
        'message', format('Product %s not found', v_item->>'product_id')
      );
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
      'product_id', v_product.id,
      'unit_price', v_unit_price,
      'quantity', v_quantity,
      'line_total', v_line_total,
      'mrp', COALESCE(v_product.mrp, v_unit_price)
    );
  END LOOP;

  v_delivery_fee := compute_delivery_fee(p_distance_km);

  IF v_delivery_fee = -1 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'OUT_OF_RANGE',
      'message', 'Sorry, this area is outside our delivery range (max 7km).'
    );
  END IF;

  IF p_coupon_code IS NOT NULL AND TRIM(p_coupon_code) != '' THEN
    v_coupon_result := validate_coupon(UPPER(TRIM(p_coupon_code)), v_user_id, v_subtotal);
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

GRANT EXECUTE ON FUNCTION public.preview_order_core(JSONB, TEXT, NUMERIC) TO authenticated;

NOTIFY pgrst, 'reload schema';
