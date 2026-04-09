-- Catalogue instant-buy stock finalization:
-- - Payment pending/cancel keeps total_stock unchanged and uses rented_stock as the reservation bucket.
-- - Payment success permanently removes bought units from active physical stock by marking
--   all_products.status = 'instantly_bought'.

CREATE OR REPLACE FUNCTION public.finalize_catalogue_buy_stock(
  p_order_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation RECORD;
  v_unit_id TEXT;
  v_idx INT;
  v_units_finalized INT := 0;
BEGIN
  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'order_id required');
  END IF;

  IF to_regclass('public.order_stock_reservations') IS NULL
     OR to_regclass('public.all_products') IS NULL THEN
    RETURN jsonb_build_object('success', true, 'units_finalized', 0, 'skipped', true);
  END IF;

  FOR v_reservation IN
    SELECT
      osr.id AS reservation_id,
      osr.variant_id,
      osr.quantity,
      i.product_id,
      i.size
    FROM public.order_stock_reservations osr
    JOIN public.inventory i ON i.id = osr.variant_id
    WHERE osr.order_id = p_order_id
      AND osr.released_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.order_items oi
        WHERE oi.order_id = p_order_id
          AND oi.product_id = i.product_id
          AND COALESCE(NULLIF(oi.size, ''), 'One Size') = COALESCE(NULLIF(i.size, ''), 'One Size')
          AND (
            COALESCE(oi.pricing_plan, '') = 'buy'
            OR COALESCE(oi.rental_duration_days, 0) = 0
          )
      )
    ORDER BY osr.variant_id ASC
    FOR UPDATE OF osr
  LOOP
    FOR v_idx IN 1..v_reservation.quantity LOOP
      v_unit_id := NULL;

      SELECT ap.individual_id
      INTO v_unit_id
      FROM public.all_products ap
      WHERE ap.inventory_id = v_reservation.variant_id
        AND COALESCE(ap.status, 'available') IN ('available', 'ready')
      ORDER BY ap.last_washed NULLS FIRST, ap.created_at, ap.individual_id
      FOR UPDATE SKIP LOCKED
      LIMIT 1;

      IF v_unit_id IS NULL THEN
        UPDATE public.inventory
        SET total_stock = GREATEST(0, total_stock - 1),
            rented_stock = GREATEST(0, rented_stock - 1)
        WHERE id = v_reservation.variant_id
          AND total_stock > 0
          AND rented_stock > 0;
      ELSE
        UPDATE public.order_items oi
        SET individual_id = v_unit_id
        WHERE oi.ctid = (
          SELECT target.ctid
          FROM public.order_items target
          WHERE target.order_id = p_order_id
            AND target.product_id = v_reservation.product_id
            AND COALESCE(NULLIF(target.size, ''), 'One Size') = COALESCE(NULLIF(v_reservation.size, ''), 'One Size')
            AND target.individual_id IS NULL
            AND (
              COALESCE(target.pricing_plan, '') = 'buy'
              OR COALESCE(target.rental_duration_days, 0) = 0
            )
          LIMIT 1
        );

        UPDATE public.all_products
        SET status = 'instantly_bought',
            available = FALSE
        WHERE individual_id = v_unit_id;
      END IF;

      v_units_finalized := v_units_finalized + 1;
    END LOOP;

    UPDATE public.order_stock_reservations
    SET released_at = NOW(),
        release_reason = 'catalogue_buy_finalized'
    WHERE id = v_reservation.reservation_id;

    PERFORM public.recalculate_inventory_stock_from_units(v_reservation.variant_id);
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'units_finalized', v_units_finalized
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.verify_payment_and_update(
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

  v_new_status := CASE WHEN v_order.order_type = 'buyout' THEN 'completed' ELSE 'confirmed' END;

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

REVOKE ALL ON FUNCTION public.finalize_catalogue_buy_stock(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_catalogue_buy_stock(UUID) TO service_role;

REVOKE ALL ON FUNCTION public.verify_payment_and_update(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_payment_and_update(UUID, TEXT, TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.verify_payment_and_update(UUID, TEXT, TEXT, TEXT) TO service_role;

NOTIFY pgrst, 'reload schema';
