CREATE OR REPLACE FUNCTION public.verify_warehouse_otp(
  p_order_id UUID,
  p_otp TEXT,
  p_actor_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_transition_result JSONB;
BEGIN
  -- We use FOR UPDATE to avoid race conditions.
  SELECT rider_id, status, warehouse_otp, warehouse_otp_used INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'message', 'Order not found.'); END IF;
  
  -- Validation logic
  IF v_order.rider_id != p_actor_id THEN RETURN jsonb_build_object('success', false, 'message', 'Not assigned to you.'); END IF;
  IF v_order.warehouse_otp != p_otp THEN RETURN jsonb_build_object('success', false, 'message', 'Invalid PIN.'); END IF;

  -- Idempotency check: if already in the target state, just return success and ensure it's marked used.
  IF v_order.status = 'driver_arrived_warehouse' THEN
      IF NOT v_order.warehouse_otp_used THEN
          UPDATE orders SET warehouse_otp_used = true WHERE id = p_order_id;
      END IF;
      RETURN jsonb_build_object('success', true, 'message', 'Already verified.', 'from', v_order.status, 'to', 'driver_arrived_warehouse', 'actor_id', p_actor_id, 'actor_role', 'rider');
  END IF;

  IF v_order.warehouse_otp_used THEN RETURN jsonb_build_object('success', false, 'message', 'PIN already used.'); END IF;

  -- Attempt the transition
  SELECT transition_order_state(p_order_id, 'driver_arrived_warehouse', 'rider', p_actor_id) INTO v_transition_result;
  
  -- Only if it succeeds do we consume the OTP.
  IF v_transition_result->>'success' = 'true' THEN
      UPDATE orders SET warehouse_otp_used = true WHERE id = p_order_id;
  END IF;

  RETURN v_transition_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
