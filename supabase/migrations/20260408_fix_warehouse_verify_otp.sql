-- Fix verify_warehouse_otp to accurately propagate errors and avoid premature consumption of OTP

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
  IF v_order.warehouse_otp_used THEN RETURN jsonb_build_object('success', false, 'message', 'PIN already used.'); END IF;

  -- Attempt the transition first
  SELECT transition_order_state(p_order_id, 'driver_arrived_warehouse', 'rider', p_actor_id) INTO v_transition_result;
  
  -- Only if it succeeds do we consume the OTP.
  IF v_transition_result->>'success' = 'true' THEN
      UPDATE orders SET warehouse_otp_used = true WHERE id = p_order_id;
  ELSE
      -- Fall back to letting the transition failure bubble up.
      RETURN v_transition_result;
  END IF;

  RETURN v_transition_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.verify_warehouse_otp(UUID, TEXT, UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
