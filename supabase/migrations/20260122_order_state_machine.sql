-- =====================================================
-- PHASE 1: ORDER STATE MACHINE
-- Migration: 20260122_order_state_machine.sql
-- Purpose: Enforce server-side state transitions with role validation
-- =====================================================

-- Order state machine with invariant enforcement
-- SECURITY DEFINER: Runs as owner, bypassing RLS for atomic operations
CREATE OR REPLACE FUNCTION transition_order_state(
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
  -- ===============================================
  -- GUARD: Admin cannot transition state (read-only by design)
  -- Admin overrides deferred to Phase 4+
  -- ===============================================
  IF p_actor_role = 'admin' THEN
    RETURN jsonb_build_object(
      'success', false, 
      'code', 'ADMIN_READ_ONLY',
      'message', 'Admin role cannot mutate order state. Use warehouse or rider role.'
    );
  END IF;

  -- ===============================================
  -- Lock row for update (prevents race conditions)
  -- ===============================================
  SELECT status, rider_id, user_id INTO v_current_status, v_order_rider_id, v_order_user_id
  FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Order does not exist');
  END IF;
  
  -- ===============================================
  -- Define allowed transitions per role
  -- Admin explicitly excluded (handled above)
  -- Note: Centralize to table in Phase 3+
  -- ===============================================
  v_allowed_transitions := '{
    "rider": {
      "dispatched": ["out_for_delivery"],
      "out_for_delivery": ["delivered"]
    },
    "customer": {
      "pending": ["cancelled"],
      "delivered": ["return_requested"]
    },
    "warehouse": {
      "pending": ["confirmed"],
      "confirmed": ["packed"],
      "packed": ["dispatched"]
    }
  }'::jsonb;
  
  -- ===============================================
  -- Validate role ownership
  -- ===============================================
  IF p_actor_role = 'rider' AND (v_order_rider_id IS NULL OR v_order_rider_id != p_actor_id) THEN
    RETURN jsonb_build_object('success', false, 'code', 'RIDER_NOT_ASSIGNED', 'message', 'Rider is not assigned to this order');
  END IF;
  
  IF p_actor_role = 'customer' AND v_order_user_id != p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'NOT_ORDER_OWNER', 'message', 'You can only modify your own orders');
  END IF;
  
  -- ===============================================
  -- Validate transition is allowed
  -- ===============================================
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
  
  -- ===============================================
  -- Execute transition
  -- ===============================================
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

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION transition_order_state(UUID, TEXT, TEXT, UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION transition_order_state IS 
'Server-side order state machine. Enforces role-based transition rules.
Admin: Read-only (ADMIN_READ_ONLY error)
Customer: pending->cancelled, delivered->return_requested
Rider: dispatched->out_for_delivery->delivered
Warehouse: pending->confirmed->packed->dispatched';
