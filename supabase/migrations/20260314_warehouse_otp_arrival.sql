-- =====================================================
-- PHASE 5: WAREHOUSE OTP FOR RIDER ARRIVAL
-- Migration: 20260314_warehouse_otp.sql
-- Purpose: Implement OTP generation and verification
--          for riders arriving at warehouses.
-- =====================================================

-- 1. Add OTP tracking fields to orders table
ALTER TABLE orders
ADD COLUMN IF NOT EXISTS warehouse_otp TEXT,
ADD COLUMN IF NOT EXISTS warehouse_otp_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS warehouse_otp_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS warehouse_otp_used BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS warehouse_otp_attempts INTEGER DEFAULT 0;

-- 2. Generate OTP RPC (For Warehouse/Admin)
CREATE OR REPLACE FUNCTION generate_warehouse_otp(p_order_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_new_otp TEXT;
  v_order_status TEXT;
  v_actor_role TEXT;
BEGIN
  -- Verify the caller is a warehouse user or admin
  SELECT role INTO v_actor_role FROM profiles WHERE user_id = auth.uid();
  IF v_actor_role NOT IN ('warehouse', 'admin') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized. Only warehouse staff can generate OTPs.');
  END IF;

  -- Ensure the order exists and is ready for pickup
  SELECT status INTO v_order_status FROM orders WHERE id = p_order_id;
  IF v_order_status IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found.');
  END IF;

  IF v_order_status != 'ready_for_pickup' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order must be in ready_for_pickup status to generate an OTP.');
  END IF;

  -- Generate new 6-digit OTP
  v_new_otp := LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');

  -- Update order with new OTP details
  UPDATE orders
  SET
    warehouse_otp = v_new_otp,
    warehouse_otp_created_at = NOW(),
    warehouse_otp_expires_at = NOW() + INTERVAL '10 minutes',
    warehouse_otp_used = false,
    warehouse_otp_attempts = 0
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'otp', v_new_otp,
    'expires_at', NOW() + INTERVAL '10 minutes'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Verify OTP RPC (For Rider)
CREATE OR REPLACE FUNCTION verify_warehouse_otp(
  p_order_id UUID,
  p_otp TEXT,
  p_actor_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_order RECORD;
  v_actor_role TEXT;
  v_transition_result JSONB;
BEGIN
  -- Verify caller is a rider
  SELECT role INTO v_actor_role FROM profiles WHERE user_id = p_actor_id;
  IF v_actor_role != 'rider' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Unauthorized. Only riders can verify arrival OTPs.');
  END IF;

  -- Get order details with locking to prevent race conditions during verification
  SELECT rider_id, status, warehouse_otp, warehouse_otp_expires_at, warehouse_otp_used, warehouse_otp_attempts 
  INTO v_order
  FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order not found.');
  END IF;

  -- Basic validations
  IF v_order.rider_id != p_actor_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'You are not assigned to this order.');
  END IF;

  IF v_order.status != 'ready_for_pickup' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order is not awaiting rider arrival.', 'current_status', v_order.status);
  END IF;

  -- OTP Validations
  IF v_order.warehouse_otp IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No OTP generated yet. Ask warehouse staff.');
  END IF;

  IF v_order.warehouse_otp_attempts >= 5 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Too many failed attempts. OTP locked. Ask warehouse to regenerate.');
  END IF;

  IF v_order.warehouse_otp_used THEN
    RETURN jsonb_build_object('success', false, 'message', 'This OTP has already been used.');
  END IF;

  IF NOW() > v_order.warehouse_otp_expires_at THEN
    RETURN jsonb_build_object('success', false, 'message', 'OTP expired. Request a new one from warehouse staff.');
  END IF;

  -- Validate the actual OTP value
  IF v_order.warehouse_otp != p_otp THEN
    -- Increment attempts on failure
    UPDATE orders SET warehouse_otp_attempts = warehouse_otp_attempts + 1 WHERE id = p_order_id;
    RETURN jsonb_build_object('success', false, 'message', 'Invalid OTP.');
  END IF;

  -- OTP is valid! Transition state using the canonical transition method.
  -- Notice we call transition_order_state which checks the app.bypass_status_check
  -- Setting the bypass allows us to call transition safely.
  
  -- But actually, we don't need to manually bypass if we just call the transition_order_state RPC
  -- However, transition_order_state is SECURITY DEFINER and handles standard roles.
  -- Wait, `transition_order_state` takes 4 parameters on this DB schema, we call it directly.

  -- Let's mark the OTP used first:
  UPDATE orders
  SET warehouse_otp_used = true
  WHERE id = p_order_id;
  
  -- Delegate status change to the unified state transition RPC 
  SELECT transition_order_state(p_order_id, 'driver_arrived_warehouse', 'rider', p_actor_id) INTO v_transition_result;

  IF NOT (v_transition_result->>'success')::BOOLEAN THEN
    -- If transition fails, we revert the OTP used flag
    UPDATE orders SET warehouse_otp_used = false WHERE id = p_order_id;
    RETURN jsonb_build_object('success', false, 'message', 'Failed to transition order state.', 'details', v_transition_result);
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'Arrival verified successfully.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
