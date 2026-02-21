-- =====================================================
-- PHASE 3: AUDIT TRIGGER
-- Migration: 20260123_audit_trigger.sql
-- Purpose: Auto-log state transitions with confidence awareness
--
-- ⚠️ DEPENDENCY: Must run AFTER 20260123_audit_log.sql
-- =====================================================

-- =====================================================
-- UPDATE transition_order_state TO LOG AUDITS
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
  -- ===============================================
  -- GUARD: Admin cannot transition state (read-only by design)
  -- ===============================================
  IF p_actor_role = 'admin' THEN
    v_result := jsonb_build_object(
      'success', false, 
      'code', 'ADMIN_READ_ONLY',
      'message', 'Admin role cannot mutate order state. Use warehouse or rider role.'
    );
    
    -- Log failed attempt
    INSERT INTO order_audit_log (order_id, actor_id, actor_role, from_status, to_status, transition_result)
    VALUES (p_order_id, p_actor_id, p_actor_role, 'unknown', p_new_status, v_result);
    
    RETURN v_result;
  END IF;

  -- ===============================================
  -- Lock row for update
  -- ===============================================
  SELECT status, rider_id, user_id INTO v_current_status, v_order_rider_id, v_order_user_id
  FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    v_result := jsonb_build_object('success', false, 'code', 'ORDER_NOT_FOUND', 'message', 'Order does not exist');
    RETURN v_result;
  END IF;
  
  -- ===============================================
  -- Allowed transitions per role
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
  
  -- ===============================================
  -- Validate transition
  -- ===============================================
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
  
  -- ===============================================
  -- Get telemetry snapshot for rider transitions (confidence-aware logging)
  -- NOTE: This is advisory logging only, never blocks
  -- ===============================================
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
    
    -- Log low-confidence incident (but NEVER block)
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
  
  -- ===============================================
  -- Execute transition
  -- ===============================================
  UPDATE orders SET status = p_new_status, updated_at = NOW()
  WHERE id = p_order_id;
  
  v_result := jsonb_build_object(
    'success', true, 
    'from', v_current_status, 
    'to', p_new_status,
    'actor_role', p_actor_role,
    'actor_id', p_actor_id
  );
  
  -- ===============================================
  -- Log successful transition with telemetry
  -- ===============================================
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

-- =====================================================
-- DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION transition_order_state IS 
'Phase 3 Enhanced: Server-side order state machine with audit logging.
All transitions (success AND failure) are logged to order_audit_log.
Rider transitions include telemetry snapshot with confidence scoring.
Low-confidence telemetry creates incident_log entry but NEVER blocks.';
