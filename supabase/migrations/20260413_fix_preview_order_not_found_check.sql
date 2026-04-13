-- ============================================================
-- Fix: Use v_product IS NULL instead of NOT FOUND after EXECUTE...INTO
-- Bug: FOUND variable is unreliable after EXECUTE...INTO inside FOR loops.
--      The FOR loop sets FOUND=true, and EXECUTE may not reset it properly
--      depending on PG version/context, causing false PRODUCT_NOT_FOUND.
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
    -- Reset v_product to NULL before each EXECUTE to avoid stale data
    v_product := NULL;

    EXECUTE format(
      'SELECT p.id, p.rental_price, p.rental_price_1d, p.rental_price_2d, p.rental_price_3d,
              p.buy_price, %s AS mrp, p.is_available
       FROM public.products p WHERE p.id = $1',
      v_product_mrp_expr
    )
    INTO v_product
    USING (v_item->>'product_id')::UUID;

    -- Use explicit NULL check instead of NOT FOUND (unreliable after EXECUTE in FOR)
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

  IF v_coupon_free_delivery THEN
    v_delivery_discount := v_delivery_fee;
    v_delivery_fee := 0;
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

GRANT EXECUTE ON FUNCTION public.preview_order_core(JSONB, TEXT, NUMERIC) TO authenticated;
NOTIFY pgrst, 'reload schema';
