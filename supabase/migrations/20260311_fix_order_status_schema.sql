-- =====================================================
-- UPDATE ORDER STATUS CONSTANTS & STATE MACHINE
-- =====================================================

-- 1. Update the CHECK constraint on the orders table
-- The constraint is currently named orders_status_check
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;

-- We include ALL statuses found across Customer, Rider, and Warehouse apps
-- to ensure no existing db rows violate the constraint during migration.
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check 
  CHECK (status IN (
    'pending', 'pending_payment', 'placed', 'confirmed', 'preparing', 'packed', 
    'ready_for_pickup', 'driver_arrived_warehouse', 'order_picked_up', 'dispatched', 
    'out_for_delivery', 'delivered', 'in_use', 
    'pickup_scheduled', 'picked_up', 
    'return_requested', 'return_scheduled', 'return_dispatched', 'return_picked_up', 'return_completed', 
    'returned', 'completed', 'cancelled'
  ));

-- 2. Update the transition_order_state function to allow the new flow
CREATE OR REPLACE FUNCTION public.transition_order_state(
  p_order_id UUID,
  p_new_status TEXT,
  p_actor_role TEXT,
  p_actor_id UUID
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
  
  -- Define allowed transitions per role WITH NEW WAREHOUSE PICKUP FLOW
  v_allowed_transitions := '{
    "rider": {
      "packed": ["ready_for_pickup", "driver_arrived_warehouse"],
      "ready_for_pickup": ["driver_arrived_warehouse", "order_picked_up"],
      "driver_arrived_warehouse": ["order_picked_up"],
      "order_picked_up": ["dispatched"],
      "dispatched": ["out_for_delivery", "delivered"],
      "out_for_delivery": ["delivered"],
      "return_requested": ["return_dispatched", "return_picked_up"],
      "return_dispatched": ["return_picked_up"],
      "return_picked_up": ["returned", "return_completed"]
    },
    "customer": {
      "pending": ["cancelled"],
      "pending_payment": ["cancelled", "placed", "confirmed"],
      "placed": ["cancelled"],
      "delivered": ["return_requested", "return_scheduled"]
    },
    "warehouse": {
      "pending": ["confirmed"],
      "placed": ["confirmed"],
      "confirmed": ["preparing", "packed"],
      "preparing": ["packed"],
      "packed": ["ready_for_pickup", "dispatched"]
    }
  }'::jsonb;
  
  -- Validate role ownership (Allow writers if no rider attached yet, so they can claim it)
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

-- Force PostgREST schema cache reload so the Rider app recognizes it immediately
NOTIFY pgrst, 'reload schema';
