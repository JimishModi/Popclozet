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
  IF p_actor_role = 'admin' THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'ADMIN_READ_ONLY',
      'message', 'Admin role cannot mutate order state. Use warehouse or rider role.'
    );
  END IF;

  SELECT status, rider_id, user_id INTO v_current_status, v_order_rider_id, v_order_user_id
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Order does not exist');
  END IF;

  -- Define allowed transitions per role
  v_allowed_transitions := '{
    "rider": {
      "rider_assigned": ["driver_arrived_warehouse", "order_picked_up"],
      "packed": ["ready_for_pickup", "driver_arrived_warehouse"],
      "ready_for_pickup": ["driver_arrived_warehouse", "order_picked_up"],
      "driver_arrived_warehouse": ["order_picked_up"],
      "order_picked_up": ["dispatched", "out_for_delivery"],
      "dispatched": ["out_for_delivery", "delivered"],
      "out_for_delivery": ["delivered"],
      "return_requested": ["return_dispatched", "return_picked_up"],
      "return_dispatched": ["return_picked_up"],
      "return_picked_up": ["return_at_warehouse"],
      "return_at_warehouse": ["returned"]
    },
    "customer": {
      "pending": ["cancelled"],
      "pending_payment": ["cancelled", "placed", "confirmed"],
      "placed": ["cancelled"],
      "delivered": ["return_requested", "return_scheduled"],
      "in_use": ["return_requested", "return_scheduled"]
    },
    "warehouse": {
      "pending": ["confirmed"],
      "placed": ["confirmed"],
      "confirmed": ["preparing", "packed"],
      "preparing": ["packed"],
      "packed": ["ready_for_pickup", "dispatched"],
      "return_requested": ["return_scheduled"],
      "return_at_warehouse": ["returned"],
      "returned": ["return_completed"]
    }
  }'::jsonb;

  -- Validate role ownership
  IF p_actor_role = 'rider' AND v_order_rider_id IS NOT NULL AND v_order_rider_id != p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'RIDER_NOT_ASSIGNED', 'message', 'Rider is not assigned to this order');
  END IF;

  IF p_actor_role = 'customer' AND v_order_user_id != p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_ORDER_OWNER', 'message', 'You can only modify your own orders');
  END IF;

  IF NOT (v_allowed_transitions->p_actor_role ? v_current_status) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_TRANSITION',
      'message', format('Role %s cannot transition from status %s', p_actor_role, v_current_status)
    );
  END IF;

  IF NOT (v_allowed_transitions->p_actor_role->v_current_status ? p_new_status) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'INVALID_TRANSITION',
      'message', format('Transition from %s to %s not allowed for role %s', v_current_status, p_new_status, p_actor_role)
    );
  END IF;

  -- Automatically assign rider if they transition it and it wasn't assigned
  IF p_actor_role = 'rider' AND v_order_rider_id IS NULL THEN
     UPDATE orders SET rider_id = p_actor_id WHERE id = p_order_id;
  END IF;

  UPDATE orders SET status = p_new_status, updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'from', v_current_status,
    'to', p_new_status,
    'actor_role', p_actor_role,
    'actor_id', p_actor_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
