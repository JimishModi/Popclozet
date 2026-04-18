-- Fix: confirm_order_payment now handles COD cash collection during delivery.
-- Previously it only worked for pending/pending_payment states, causing
-- "Cannot confirm payment for order in state: out_for_delivery" when
-- customer taps "Pay Cash to Rider" on the tracking page.

CREATE OR REPLACE FUNCTION confirm_order_payment(
  p_order_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order RECORD;
  v_user_id UUID := auth.uid();
  v_new_otp TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'UNAUTHENTICATED');
  END IF;

  SELECT id, user_id, status, payment_method, cod_payment_collected
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_FOUND', 'message', 'Order not found');
  END IF;

  IF v_order.user_id != v_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'FORBIDDEN', 'message', 'Not your order');
  END IF;

  -- COD orders in delivery states: mark cash as collected and generate OTP
  IF v_order.payment_method = 'cod'
     AND v_order.status IN ('order_picked_up', 'dispatched', 'out_for_delivery') THEN

    -- Already collected? Return idempotent success
    IF v_order.cod_payment_collected = TRUE THEN
      RETURN jsonb_build_object(
        'success', true, 'order_id', p_order_id,
        'already_processed', true, 'cod_payment_collected', true
      );
    END IF;

    v_new_otp := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');

    UPDATE orders
    SET cod_payment_collected = TRUE,
        otp_delivery = v_new_otp,
        updated_at = NOW()
    WHERE id = p_order_id;

    RETURN jsonb_build_object(
      'success', true, 'order_id', p_order_id,
      'new_status', v_order.status,
      'cod_payment_collected', true,
      'otp', v_new_otp
    );
  END IF;

  -- Standard payment confirmation (pending/pending_payment → confirmed)
  IF v_order.status NOT IN ('pending', 'pending_payment') THEN
    -- Already confirmed? Return success (idempotent)
    IF v_order.status IN ('confirmed', 'packed', 'dispatched') THEN
      RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'already_processed', true);
    END IF;
    RETURN jsonb_build_object(
      'success', false, 'code', 'INVALID_STATE',
      'message', format('Cannot confirm payment for order in state: %s', v_order.status)
    );
  END IF;

  UPDATE orders SET status = 'confirmed', updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true, 'order_id', p_order_id, 'new_status', 'confirmed');
END;
$$;
