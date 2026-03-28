CREATE OR REPLACE FUNCTION public.transition_order_state(
  p_order_id UUID,
  p_new_status TEXT,
  p_actor_role TEXT,
  p_actor_id UUID,
  p_rider_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_allowed_transitions JSONB;
  v_order_rider_id UUID;
  v_order_user_id UUID;
BEGIN
  -- Lock the row
  SELECT status, rider_id, user_id INTO v_current_status, v_order_rider_id, v_order_user_id
  FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Order does not exist');
  END IF;
  
  -- Rules: Ensure Rider pickup/delivery works
  v_allowed_transitions := '{
    "rider": {
      "rider_assigned": ["driver_arrived_warehouse", "order_picked_up"],
      "confirmed": ["driver_arrived_warehouse"],
      "ready_for_pickup": ["driver_arrived_warehouse", "order_picked_up"],
      "driver_arrived_warehouse": ["order_picked_up"],
      "order_picked_up": ["out_for_delivery", "dispatched"],
      "dispatched": ["out_for_delivery", "delivered"],
      "out_for_delivery": ["delivered"],
      "delivered": []
    },
    "warehouse": {
      "pending": ["confirmed"],
      "confirmed": ["packed"],
      "packed": ["ready_for_pickup", "dispatched"],
      "ready_for_pickup": ["dispatched"]
    },
    "customer": {
      "pending": ["cancelled"],
      "delivered": ["return_requested"]
    },
    "admin": {
      "pending": ["cancelled"],
      "confirmed": ["cancelled"]
    }
  }'::jsonb;
  
  -- Ownership Check
  IF p_actor_role = 'rider' AND v_order_rider_id IS NOT NULL AND v_order_rider_id != p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'Rider is not assigned to this order');
  END IF;
  
  -- Transition Check
  IF NOT (v_allowed_transitions->p_actor_role ? v_current_status) THEN
    RETURN jsonb_build_object('success', false, 'message', format('Role %s cannot transition from %s', p_actor_role, v_current_status));
  END IF;

  IF NOT (v_allowed_transitions->p_actor_role->v_current_status ? p_new_status) THEN
    -- If already in target status, return success (idempotent)
    IF v_current_status = p_new_status THEN
        RETURN jsonb_build_object('success', true, 'message', 'Status already set');
    END IF;
    RETURN jsonb_build_object('success', false, 'message', format('Transition %s -> %s not allowed for %s', v_current_status, p_new_status, p_actor_role));
  END IF;

  -- Update
  UPDATE orders SET status = p_new_status, updated_at = NOW() WHERE id = p_order_id;
  
  -- Re-assign rider if provided
  IF p_rider_id IS NOT NULL THEN
    UPDATE orders SET rider_id = p_rider_id WHERE id = p_order_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
