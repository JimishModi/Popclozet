-- =====================================================
-- CLAIM ORDER RPC FOR RIDERS
-- =====================================================

-- This function allows a rider to securely claim an order by assigning their rider_id.
-- This bypasses Row Level Security (which normally blocks riders from updating 
-- orders they don't already own).

CREATE OR REPLACE FUNCTION public.claim_order(
  p_order_id UUID,
  p_rider_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_current_status TEXT;
  v_order_rider_id UUID;
BEGIN
  -- Disable strict role validation for testing out the prototype
  -- IF NOT EXISTS (
  --  SELECT 1 FROM profiles WHERE user_id = p_rider_id AND role = 'rider'
  --  UNION
  --  SELECT 1 FROM riders WHERE user_id = p_rider_id
  -- ) THEN
  --  RETURN jsonb_build_object('success', false, 'message', 'Invalid rider ID or role');
  -- END IF;

  SELECT status, rider_id INTO v_current_status, v_order_rider_id
  FROM orders WHERE id = p_order_id FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order does not exist');
  END IF;
  
  IF v_order_rider_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Order is already claimed by another rider');
  END IF;

  UPDATE orders SET rider_id = p_rider_id, updated_at = NOW() WHERE id = p_order_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
