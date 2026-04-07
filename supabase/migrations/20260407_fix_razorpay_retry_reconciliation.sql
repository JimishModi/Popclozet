-- Fix Razorpay retry reconciliation and durable stock reservation persistence.
--
-- Why this exists:
-- 1. order_stock_reservations uses RLS with no INSERT policy for authenticated users,
--    so the frontend's direct insert can fail and leave reserved stock stuck.
-- 2. Razorpay can emit payment.failed for an earlier attempt on the same order before
--    a later retry succeeds. Order reconciliation should remain retry-safe.

CREATE OR REPLACE FUNCTION public.persist_order_stock_reservations(
  p_order_id UUID,
  p_items    JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_item RECORD;
  v_user_id UUID := auth.uid();
  v_inserted INT := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED', 'message', 'Authentication required');
  END IF;

  IF p_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT', 'message', 'order_id required');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'INVALID_INPUT', 'message', 'Reservation items required');
  END IF;

  SELECT id, user_id, status
  INTO v_order
  FROM public.orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  IF v_order.user_id <> v_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Not your order');
  END IF;

  IF v_order.status NOT IN ('pending', 'pending_payment', 'payment_failed', 'confirmed') THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_STATE',
      'message', format('Cannot persist reservations for order in state: %s', v_order.status)
    );
  END IF;

  FOR v_item IN
    SELECT
      (elem->>'variant_id')::UUID AS variant_id,
      GREATEST(COALESCE((elem->>'quantity')::INT, 0), 0) AS quantity
    FROM jsonb_array_elements(p_items) AS elem
  LOOP
    IF v_item.variant_id IS NULL OR v_item.quantity <= 0 THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'INVALID_ITEM',
        'message', 'Each reservation item requires variant_id and quantity > 0'
      );
    END IF;

    BEGIN
      INSERT INTO public.order_stock_reservations (
        order_id,
        variant_id,
        quantity
      ) VALUES (
        p_order_id,
        v_item.variant_id,
        v_item.quantity
      );

      v_inserted := v_inserted + 1;
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'order_id', p_order_id,
    'inserted_count', v_inserted
  );
END;
$$;

REVOKE ALL ON FUNCTION public.persist_order_stock_reservations(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.persist_order_stock_reservations(UUID, JSONB) TO authenticated;

NOTIFY pgrst, 'reload schema';
