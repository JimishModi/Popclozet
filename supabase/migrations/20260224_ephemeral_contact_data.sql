-- =====================================================
-- PHASE 4: EPHEMERAL PII FOR ORDERS
-- Migration: 20260224_ephemeral_contact_data.sql
-- Purpose: Clear OTPs and delivery address snapshot when
--          an order reaches a terminal delivered/returned state.
-- =====================================================

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
  v_result JSONB;
  v_telemetry JSONB;
  v_confidence DOUBLE PRECISION;
BEGIN
  -- Admin remains read-only
  IF p_actor_role = 'admin' THEN
    v_result := jsonb_build_object(
      'success', false, 
      'code', 'ADMIN_READ_ONLY',
      'message', 'Admin role cannot mutate order state. Use warehouse or rider role.'
    );
    
    INSERT INTO order_audit_log (order_id, actor_id, actor_role, from_status, to_status, transition_result)
    VALUES (p_order_id, p_actor_id, p_actor_role, 'unknown', p_new_status, v_result);
    
    RETURN v_result;
  END IF;

  -- Lock row for update
  SELECT status, rider_id, user_id INTO v_current_status, v_order_rider_id, v_order_user_id
  FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    v_result := jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Order does not exist');
    RETURN v_result;
  END IF;
  
  -- Allowed transitions per role
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
  
  -- Role ownership validation
  IF p_actor_role = 'rider' AND (v_order_rider_id IS NULL OR v_order_rider_id != p_actor_id) THEN
    v_result := jsonb_build_object('success', false, 'code', 'RIDER_NOT_ASSIGNED', 'message', 'Rider is not assigned to this order');
    
    INSERT INTO order_audit_log (order_id, actor_id, actor_role, from_status, to_status, transition_result)
    VALUES (p_order_id, p_actor_id, p_actor_role, v_current_status, p_new_status, v_result);
    
    RETURN v_result;
  END IF;
  
  IF p_actor_role = 'customer' AND v_order_user_id != p_actor_id THEN
    v_result := jsonb_build_object('success', false, 'code', 'NOT_ORDER_OWNER', 'message', 'You can only modify your own orders');
    
    INSERT INTO order_audit_log (order_id, actor_id, actor_role, from_status, to_status, transition_result)
    VALUES (p_order_id, p_actor_id, p_actor_role, v_current_status, p_new_status, v_result);
    
    RETURN v_result;
  END IF;
  
  -- Validate transition
  IF NOT (v_allowed_transitions->p_actor_role ? v_current_status) THEN
    v_result := jsonb_build_object(
      'success', false, 
      'code', 'INVALID_TRANSITION',
      'message', format('Role %s cannot transition from status %s', p_actor_role, v_current_status)
    );
    
    INSERT INTO order_audit_log (order_id, actor_id, actor_role, from_status, to_status, transition_result)
    VALUES (p_order_id, p_actor_id, p_actor_role, v_current_status, p_new_status, v_result);
    
    RETURN v_result;
  END IF;

  IF NOT (v_allowed_transitions->p_actor_role->v_current_status ? p_new_status) THEN
    v_result := jsonb_build_object(
      'success', false, 
      'code', 'INVALID_TRANSITION',
      'message', format('Transition from %s to %s not allowed for role %s', v_current_status, p_new_status, p_actor_role)
    );
    
    INSERT INTO order_audit_log (order_id, actor_id, actor_role, from_status, to_status, transition_result)
    VALUES (p_order_id, p_actor_id, p_actor_role, v_current_status, p_new_status, v_result);
    
    RETURN v_result;
  END IF;
  
  -- Telemetry snapshot for rider transitions
  IF p_actor_role = 'rider' THEN
    SELECT 
      jsonb_build_object(
        'latitude', latitude,
        'longitude', longitude,
        'accuracy_meters', accuracy_meters,
        'source', source,
        'timestamp', timestamp
      ),
      COALESCE(confidence, 1.0)
    INTO v_telemetry, v_confidence
    FROM rider_locations
    WHERE rider_id = p_actor_id
    ORDER BY timestamp DESC
    LIMIT 1;
    
    IF v_confidence IS NOT NULL AND v_confidence < 0.5 THEN
      INSERT INTO incident_log (
        order_id, 
        incident_type, 
        severity,
        description,
        metadata
      ) VALUES (
        p_order_id,
        'low_confidence_telemetry',
        CASE WHEN v_confidence < 0.2 THEN 'high' ELSE 'medium' END,
        format('Rider transition with low confidence telemetry (%.2f)', v_confidence),
        jsonb_build_object(
          'rider_id', p_actor_id,
          'confidence', v_confidence,
          'from_status', v_current_status,
          'to_status', p_new_status
        )
      );
    END IF;
  END IF;
  
  -- Execute transition with ephemeral PII clearing for terminal states
  UPDATE orders
  SET
    status = p_new_status,
    updated_at = NOW(),
    delivery_address_snapshot = CASE
      WHEN p_new_status IN ('delivered', 'return_picked_up', 'returned', 'completed')
      THEN NULL
      ELSE delivery_address_snapshot
    END,
    otp_delivery = CASE
      WHEN p_new_status IN ('delivered', 'return_picked_up', 'returned', 'completed')
      THEN NULL
      ELSE otp_delivery
    END,
    otp_return = CASE
      WHEN p_new_status IN ('delivered', 'return_picked_up', 'returned', 'completed')
      THEN NULL
      ELSE otp_return
    END
  WHERE id = p_order_id;
  
  v_result := jsonb_build_object(
    'success', true, 
    'from', v_current_status, 
    'to', p_new_status,
    'actor_role', p_actor_role,
    'actor_id', p_actor_id
  );
  
  INSERT INTO order_audit_log (
    order_id, 
    actor_id, 
    actor_role, 
    from_status, 
    to_status, 
    transition_result,
    telemetry_snapshot,
    confidence_score
  ) VALUES (
    p_order_id, 
    p_actor_id, 
    p_actor_role, 
    v_current_status, 
    p_new_status, 
    v_result,
    v_telemetry,
    v_confidence
  );
  
  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION transition_order_state IS 
'Phase 4: Order state machine with immutable audit log, telemetry-aware incidents, and ephemeral PII.
When orders reach delivered/returned states, delivery_address_snapshot and OTP fields are cleared.';

